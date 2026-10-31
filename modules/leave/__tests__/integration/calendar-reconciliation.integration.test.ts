import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanCalendarFixtures } from "./calendar-cleanup";
import { prisma } from "@/lib/db/prisma";
import * as audit from "@/modules/audit";
import { randomUUID } from "node:crypto";
import { decideLeaveRequest } from "../../application/approvals/decision";
import {
    cancelLeaveRequest,
    confirmLeaveCancellation,
} from "../../application/cancellation/cancellation";
import { confirmLeaveNotTaken, requestLeaveNotTaken } from "../../application/not-taken";
import {
    getCalendarImpact,
    reconcileCalendarLeave,
} from "../../application/calendar/reconciliation";
import { ensureLeaveQuotaForYear } from "../../domain/quota-entitlement";
import {
    createCalendarFixture,
    holiday,
    publishCalendar,
    requestCalendarLeave,
    calendarDraft,
    type CalendarFixture,
} from "./calendar-fixture";
import type { CalendarReconcileInput } from "../../domain/calendar-reconciliation";

describe.sequential("calendar reconciliation and remaining charges on real MySQL", () => {
    afterAll(cleanCalendarFixtures);
    let f: CalendarFixture;
    beforeEach(async () => {
        vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "true");
        f = await createCalendarFixture();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it("rolls back charge, usage, future carry, ledger and audit if the final audit write fails", async () => {
        const { request } = await approved();
        const future = await prisma.$transaction((tx) => ensureLeaveQuotaForYear(tx, { employeeId: f.owner.employeeId, year: f.year + 1, leaveType: "VACATION" }));
        const version = await publishCalendar(f, [holiday(f.middle)]);
        vi.spyOn(audit, "appendAuditInTransaction").mockRejectedValueOnce(new Error("injected audit persistence failure"));
        await expect(reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6))).rejects.toThrow("injected audit");
        expect((await usage()).usedHalfDays).toBe(6);
        expect((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } })).chargedHalfDays).toBe(6);
        expect((await prisma.leaveQuota.findUniqueOrThrow({ where: { id: future.id } })).carryBalanceHalfDays).toBe(future.carryBalanceHalfDays);
        expect(await prisma.leaveCalendarAdjustment.count({ where: { leaveRequestId: request.id } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { action: "LEAVE_CALENDAR_RECONCILE", entityId: f.year } })).toBe(0);
    });

    async function approved(
        days: ReturnType<typeof holiday>[] = [],
        leaveType: "SICK" | "PERSONAL" | "VACATION" = "VACATION",
    ) {
        const originalVersion = await publishCalendar(f, days);
        const { request } = await requestCalendarLeave(f, { leaveType });
        await decideLeaveRequest(f.approver, { leaveId: request.id, action: "APPROVE" });
        return { request, originalVersion };
    }

    function confirmation(id: string, versionId: string, previous: number): CalendarReconcileInput {
        return {
            year: f.year,
            leaveRequestId: id,
            calendarVersionId: versionId,
            expectedChargeHalfDays: previous,
            confirmed: true,
            reason: "ตรวจสอบปฏิทินองค์กรและยืนยันปรับยอด",
        };
    }

    async function usage(leaveType: "SICK" | "PERSONAL" | "VACATION" = "VACATION") {
        return prisma.leaveQuota.findUniqueOrThrow({
            where: {
                employeeId_year_leaveType: {
                    employeeId: f.owner.employeeId,
                    year: f.year,
                    leaveType,
                },
            },
        });
    }

    it("previews draft changes over full request ranges without modifying requests or quotas", async () => {
        const { request, originalVersion } = await approved();
        const draft = await calendarDraft(f, [holiday(f.middle)]);
        const impact = await getCalendarImpact(f.admin, { year: f.year, versionId: draft.id });
        expect(impact).toMatchObject({
            activeVersionId: originalVersion,
            proposedVersionId: draft.id,
            proposedPublished: false,
            addedHolidays: [f.middle],
        });
        expect(impact.rows).toEqual([
            expect.objectContaining({
                id: request.id,
                employeeName: expect.any(String),
                originalDurationHalfDays: 6,
                chargedHalfDays: 6,
                proposedChargeHalfDays: 4,
                differenceHalfDays: -2,
                action: "RECONCILE",
            }),
        ]);
        expect((await usage()).usedHalfDays).toBe(6);
        await expect(
            reconcileCalendarLeave(f.admin, confirmation(request.id, draft.id, 6)),
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("refunds exactly once under real concurrent confirmations and preserves duration/version history", async () => {
        const { request, originalVersion } = await approved();
        const version = await publishCalendar(f, [holiday(f.middle)]);
        const input = confirmation(request.id, version, 6);
        const other = await createCalendarFixture();
        const outcomes = await Promise.all([
            reconcileCalendarLeave(f.admin, input),
            reconcileCalendarLeave(other.admin, input),
        ]);
        expect(outcomes.map((result) => result.replayed).sort()).toEqual([false, true]);
        const filters = { page: 1, limit: 10, entityType: "HolidayCalendar" };
        expect((await audit.getAuditLogs(filters, { id: f.owner.userId, role: "USER" })).pagination.total).toBe(0);
        expect((await audit.getAuditLogs(filters, { id: f.admin.userId, role: "ADMIN" })).pagination.total).toBeGreaterThan(0);
        expect((await usage()).usedHalfDays).toBe(4);
        expect(
            await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } }),
        ).toMatchObject({
            durationHalfDays: 6,
            chargedHalfDays: 4,
            calculationCalendarVersionId: originalVersion,
            approvalCalendarVersionId: originalVersion,
        });
        expect(
            await prisma.leaveCalendarAdjustment.count({ where: { leaveRequestId: request.id } }),
        ).toBe(1);
        expect((await reconcileCalendarLeave(f.admin, input)).replayed).toBe(true);
        await expect(
            reconcileCalendarLeave(f.admin, { ...input, reason: "เหตุผลอื่นหลังปรับแล้ว" }),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
            prisma.leaveCalendarAdjustment.update({
                where: { id: outcomes[0].adjustment.id },
                data: { reason: "rewrite" },
            }),
        ).rejects.toThrow();
        await expect(
            prisma.leaveCalendarAdjustment.delete({ where: { id: outcomes[0].adjustment.id } }),
        ).rejects.toThrow();
    });

    it("cancellation after a partial refund restores only remaining charge", async () => {
        const { request } = await approved();
        const version = await publishCalendar(f, [holiday(f.middle)]);
        await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6));
        await cancelLeaveRequest(f.owner, request.id, "เปลี่ยนแผนการลา");
        await confirmLeaveCancellation({ ...f.approver, role: "ADMIN" }, request.id);
        expect((await usage()).usedHalfDays).toBe(0);
        expect(
            await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } }),
        ).toMatchObject({
            durationHalfDays: 6,
            chargedHalfDays: 0,
            status: "CANCELLED_AFTER_APPROVAL",
        });
        await expect(
            confirmLeaveCancellation({ ...f.approver, role: "ADMIN" }, request.id),
        ).rejects.toThrow();
        await expect(
            reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6)),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(
            (await getCalendarImpact(f.admin, { year: f.year, versionId: version })).rows[0]
                .adjustments,
        ).toHaveLength(1);
    });

    it("not-taken confirmation after refund restores only remaining charge", async () => {
        const { request } = await approved();
        const version = await publishCalendar(f, [holiday(f.middle)]);
        await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6));
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(`${f.year + 1}-01-02T00:00:00Z`));
        const owner = {
            user: { id: f.owner.userId, role: "USER", email: f.owner.userEmail, name: "Requester" },
            employeeId: f.owner.employeeId,
            authorization: f.owner.authorization,
        };
        const approver = {
            user: {
                id: f.approver.userId,
                role: "ADMIN",
                email: f.approver.userEmail,
                name: "Manager",
            },
            employeeId: f.approver.employeeId,
            authorization: f.approver.authorization,
        };
        await requestLeaveNotTaken({
            actor: owner,
            leaveId: request.id,
            note: "ไม่ได้ใช้วันลาตามแผน",
        });
        await confirmLeaveNotTaken({
            actor: approver,
            leaveId: request.id,
            allowAdminOverride: false,
        });
        expect((await usage()).usedHalfDays).toBe(0);
        expect(
            await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } }),
        ).toMatchObject({ durationHalfDays: 6, chargedHalfDays: 0, status: "NOT_TAKEN" });
        await expect(
            confirmLeaveNotTaken({
                actor: approver,
                leaveId: request.id,
                allowAdminOverride: false,
            }),
        ).rejects.toThrow();
    });

    it("sequential revisions reconcile from the latest charge and a fully refunded request cannot refund again", async () => {
        const { request } = await approved();
        let version = await publishCalendar(f, [holiday(f.middle)]);
        await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6));
        version = await publishCalendar(f, [holiday(f.start), holiday(f.middle), holiday(f.end)]);
        await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 4));
        expect((await usage()).usedHalfDays).toBe(0);
        const history = await prisma.leaveCalendarAdjustment.findMany({
            where: { leaveRequestId: request.id },
            orderBy: { createdAt: "asc" },
        });
        expect(history.map((row) => [row.previousHalfDays, row.resultingHalfDays])).toEqual([
            [6, 4],
            [4, 0],
        ]);
        await cancelLeaveRequest(f.owner, request.id, "ยกเลิกคำขอที่คืนครบแล้ว");
        await confirmLeaveCancellation({ ...f.approver, role: "ADMIN" }, request.id);
        expect((await usage()).usedHalfDays).toBe(0);
    });

    it("removing a holiday increases the effective charge without editing original duration", async () => {
        const { request } = await approved([holiday(f.middle)]);
        const version = await publishCalendar(f);
        expect(
            (await getCalendarImpact(f.admin, { year: f.year, versionId: version })).rows[0],
        ).toMatchObject({
            originalDurationHalfDays: 4,
            proposedChargeHalfDays: 6,
            differenceHalfDays: 2,
        });
        await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 4));
        expect((await usage()).usedHalfDays).toBe(6);
        expect(
            await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } }),
        ).toMatchObject({ durationHalfDays: 4, chargedHalfDays: 6 });
    });

    it("rejects stale published versions and stale charge previews", async () => {
        const { request } = await approved();
        const stale = await publishCalendar(f, [holiday(f.middle)]);
        const current = await publishCalendar(f, [holiday(f.end)]);
        await expect(
            reconcileCalendarLeave(f.admin, confirmation(request.id, stale, 6)),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
            reconcileCalendarLeave(f.admin, confirmation(request.id, current, 4)),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect((await usage()).usedHalfDays).toBe(6);
    });

    it.each(["PERSONAL", "VACATION", "SICK"] as const)(
        "preserves %s future-year usage and its carry policy",
        async (leaveType) => {
            const { request } = await approved([], leaveType);
            const future = await prisma.$transaction((tx) =>
                ensureLeaveQuotaForYear(tx, {
                    employeeId: f.owner.employeeId,
                    year: f.year + 1,
                    leaveType,
                }),
            );
            await prisma.leaveQuota.update({ where: { id: future.id }, data: { usedHalfDays: 2 } });
            const version = await publishCalendar(f, [holiday(f.middle)]);
            await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6));
            const after = await prisma.leaveQuota.findUniqueOrThrow({ where: { id: future.id } });
            expect(after.usedHalfDays).toBe(2);
            expect(after.carryBalanceHalfDays).toBe(
                leaveType === "SICK" ? 0 : future.carryBalanceHalfDays + 2,
            );
        },
    );

    it.each([false, true])(
        "requires special ADMIN justification for additional over-quota exposure (future only: %s)",
        async (futureOnly) => {
            const { request } = await approved([holiday(f.middle)]);
            const quota = await usage();
            if (futureOnly) {
                const future = await prisma.$transaction((tx) =>
                    ensureLeaveQuotaForYear(tx, {
                        employeeId: f.owner.employeeId,
                        year: f.year + 1,
                        leaveType: "VACATION",
                    }),
                );
                await prisma.leaveQuota.update({
                    where: { id: future.id },
                    data: { usedHalfDays: future.totalHalfDays + future.carryBalanceHalfDays },
                });
            } else
                await prisma.leaveQuota.update({
                    where: { id: quota.id },
                    data: { usedHalfDays: quota.totalHalfDays },
                });
            const before = (await usage()).usedHalfDays;
            const version = await publishCalendar(f);
            const input = confirmation(request.id, version, 4);
            await expect(reconcileCalendarLeave(f.admin, input)).rejects.toMatchObject({
                statusCode: 409,
                message: expect.stringContaining("เหตุผลพิเศษ"),
            });
            expect((await usage()).usedHalfDays).toBe(before);
            expect(
                await prisma.leaveCalendarAdjustment.count({
                    where: { leaveRequestId: request.id },
                }),
            ).toBe(0);
            await reconcileCalendarLeave(f.admin, {
                ...input,
                overQuotaJustification: "ตรวจผลเกินสิทธิ์และยอดยกไปปีถัดไปแล้ว อนุมัติการปรับ",
            });
            expect((await usage()).usedHalfDays).toBe(before + 2);
        },
    );

    it("denies USER impact/reconciliation and cancellation-requested adjustments", async () => {
        const { request } = await approved();
        const version = await publishCalendar(f, [holiday(f.middle)]);
        const user = { userId: f.owner.userId, channel: "DASHBOARD" as const };
        await expect(
            getCalendarImpact(user, { year: f.year, versionId: version }),
        ).rejects.toMatchObject({ statusCode: 403 });
        await expect(
            reconcileCalendarLeave(user, confirmation(request.id, version, 6)),
        ).rejects.toMatchObject({ statusCode: 403 });
        await cancelLeaveRequest(f.owner, request.id, "ขอยกเลิกใบลา");
        expect(
            (await getCalendarImpact(f.admin, { year: f.year, versionId: version })).rows[0].action,
        ).toBe("WAIT_CANCELLATION");
        await expect(
            reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6)),
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("supports legacy NULL charge and unknown calculation versions without rewriting historical facts", async () => {
        const version = await publishCalendar(f, [holiday(f.middle)]);
        const request = await prisma.leaveRequest.create({
            data: {
                employeeId: f.owner.employeeId,
                approverId: f.approver.employeeId,
                leaveType: "VACATION",
                startDate: new Date(`${f.start}T00:00:00Z`),
                endDate: new Date(`${f.end}T00:00:00Z`),
                durationHalfDays: 6,
                status: "APPROVED",
                approvedAt: new Date(),
                reason: "Legacy approved fixture",
            },
        });
        await prisma.leaveQuota.create({
            data: {
                employeeId: f.owner.employeeId,
                year: f.year,
                leaveType: "VACATION",
                totalHalfDays: 12,
                usedHalfDays: 6,
            },
        });
        expect(request.chargedHalfDays).toBeNull();
        await reconcileCalendarLeave(f.admin, confirmation(request.id, version, 6));
        expect(
            await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } }),
        ).toMatchObject({
            durationHalfDays: 6,
            chargedHalfDays: 4,
            calculationCalendarVersionId: null,
            approvalCalendarVersionId: null,
            approvedAt: request.approvedAt,
        });
    });

    it("cancels legacy approved history even when no calendar for its year exists", async () => {
        const request = await prisma.leaveRequest.create({
            data: {
                employeeId: f.owner.employeeId,
                approverId: f.approver.employeeId,
                leaveType: "VACATION",
                startDate: new Date(`${f.start}T00:00:00Z`),
                endDate: new Date(`${f.end}T00:00:00Z`),
                durationHalfDays: 6,
                status: "APPROVED",
                approvedAt: new Date(),
                reason: "Legacy without published calendar",
            },
        });
        await prisma.leaveQuota.create({
            data: {
                employeeId: f.owner.employeeId,
                year: f.year,
                leaveType: "VACATION",
                totalHalfDays: 12,
                usedHalfDays: 6,
            },
        });
        await cancelLeaveRequest(f.owner, request.id, "ยกเลิกข้อมูลคำขอเดิม");
        await confirmLeaveCancellation({ ...f.approver, role: "ADMIN" }, request.id);
        expect((await usage()).usedHalfDays).toBe(0);
        expect(await prisma.holidayCalendar.findUnique({ where: { year: f.year } })).toBeNull();
        // Claim this synthetic year so future fixture allocation remains isolated.
        await publishCalendar(f);
    });

    it("paginates every request across full ranges without skipping or duplicating rows", async () => {
        const version = await publishCalendar(f, [holiday(f.middle)]);
        await prisma.leaveRequest.createMany({
            data: Array.from({ length: 26 }, () => ({
                id: randomUUID(),
                employeeId: f.owner.employeeId,
                approverId: f.approver.employeeId,
                leaveType: "VACATION" as const,
                startDate: new Date(`${f.start}T00:00:00Z`),
                endDate: new Date(`${f.end}T00:00:00Z`),
                durationHalfDays: 6,
                reason: "Pagination fixture",
                status: "PENDING" as const,
            })),
        });
        const first = await getCalendarImpact(f.admin, { year: f.year, versionId: version });
        expect(first.rows).toHaveLength(25);
        const next = await getCalendarImpact(f.admin, {
            year: f.year,
            versionId: version,
            cursor: first.nextCursor,
        });
        expect(next.rows).toHaveLength(1);
        expect(next.nextCursor).toBeNull();
        expect(new Set([...first.rows, ...next.rows].map((row) => row.id)).size).toBe(26);
        expect(
            [...first.rows, ...next.rows].every(
                (row) => row.action === "CANCEL_AND_RESUBMIT" && row.proposedDurationHalfDays === 4,
            ),
        ).toBe(true);
    });
});
