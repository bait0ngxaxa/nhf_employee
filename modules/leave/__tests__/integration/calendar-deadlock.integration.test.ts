import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { assertCalendarAdmin, getCalendarAdminEmployeeIdHint } from "../../application/calendar/authorization";
import { getManagedHolidayCalendar } from "../../application/calendar/calendar";
import { calendarDraft, createCalendarFixture, type CalendarFixture } from "./calendar-fixture";
import { cleanCalendarFixtures } from "./calendar-cleanup";

describe.sequential("calendar read raw MySQL deadlock recovery", () => {
    let f: CalendarFixture;
    beforeAll(async () => { f = await createCalendarFixture(); await calendarDraft(f, []); });
    afterAll(cleanCalendarFixtures);

    it("restarts the whole transaction after the real ADMIN hint-read/row-lock cycle", async () => {
        let releaseHints: () => void = () => { throw new Error("Barrier not initialized"); };
        const hintsReady = new Promise<void>((resolve) => { releaseHints = resolve; });
        let firstHints = 0;
        const attempts = [0, 0];
        const deadlocks: unknown[] = [];
        const outcomes = await Promise.allSettled(attempts.map((_attempt, index) => runSerializableTransaction(async (tx) => {
            attempts[index] += 1;
            // Reproduce the old authorization order: Serializable hint SELECT holds User S.
            const hint = await tx.user.findUniqueOrThrow({ where: { id: f.admin.userId }, select: { employeeId: true } });
            if (hint.employeeId === null) throw new Error("Fixture ADMIN must have an Employee");
            await tx.auditLog.create({ data: { action: "DATA_EXPORT", entityType: "CalendarDeadlockFixture", entityId: f.year, userId: f.admin.userId } });
            if (attempts[index] === 1) {
                firstHints += 1;
                if (firstHints === 2) releaseHints();
                await hintsReady;
            }
            // Both hold User S. One holds Employee X, then requests User X;
            // the other waits for Employee X: MySQL must choose a deadlock victim.
            try {
                await lockEmployeeRows(tx, [hint.employeeId]);
                await lockUserRows(tx, [f.admin.userId]);
            } catch (error) {
                deadlocks.push(error);
                throw error;
            }
            return assertCalendarAdmin(tx, f.admin, hint.employeeId);
        })));
        expect(outcomes).toEqual([
            { status: "fulfilled", value: expect.objectContaining({ id: f.admin.userId }) },
            { status: "fulfilled", value: expect.objectContaining({ id: f.admin.userId }) },
        ]);
        expect(attempts[0] + attempts[1]).toBeGreaterThan(2);
        expect(Math.max(...attempts)).toBeLessThanOrEqual(4);
        expect(deadlocks).toEqual(expect.arrayContaining([expect.objectContaining({ code: "P2010", meta: expect.objectContaining({ code: "1213" }) })]));
        // The victim's first Audit insert rolled back; a retry commits exactly once per caller.
        expect(await prisma.auditLog.count({ where: { entityType: "CalendarDeadlockFixture", entityId: f.year } })).toBe(2);
    });

    it("serves overlapping ADMIN calendar reads without exposing a transient deadlock", async () => {
        const before = await prisma.holidayCalendarVersion.count({ where: { year: f.year } });
        const transactions = vi.spyOn(prisma, "$transaction");
        try {
            for (let pair = 0; pair < 5; pair += 1) {
                const outcomes = await Promise.allSettled([
                    getManagedHolidayCalendar(f.admin, f.year),
                    getManagedHolidayCalendar(f.admin, f.year),
                ]);
                expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
            }
            // Retry recovery alone must not hide a repeated calendar authorization lock cycle.
            expect(transactions).toHaveBeenCalledTimes(10);
        } finally {
            transactions.mockRestore();
        }
        expect(await prisma.holidayCalendarVersion.count({ where: { year: f.year } })).toBe(before);
    });

    it("fails closed if the Employee relationship changed after reading the lock hint", async () => {
        const hint = await getCalendarAdminEmployeeIdHint(f.admin);
        await prisma.user.update({ where: { id: f.admin.userId }, data: { employeeId: null } });
        try {
            await expect(runSerializableTransaction((tx) => assertCalendarAdmin(tx, f.admin, hint))).rejects.toMatchObject({ statusCode: 403 });
        } finally {
            await prisma.user.update({ where: { id: f.admin.userId }, data: { employeeId: hint } });
        }
    });

    it.each([
        { role: "USER" as const },
        { isActive: false },
        { deletedAt: new Date() },
    ])("retains persisted ADMIN account eligibility: %j", async (data) => {
        await prisma.user.update({ where: { id: f.admin.userId }, data });
        try {
            await expect(getManagedHolidayCalendar(f.admin, f.year)).rejects.toMatchObject({ statusCode: 403 });
        } finally {
            await prisma.user.update({ where: { id: f.admin.userId }, data: { role: "ADMIN", isActive: true, deletedAt: null } });
        }
    });

    it.each([
        { status: "INACTIVE" as const },
        { status: "SUSPENDED" as const },
        { deletedAt: new Date() },
    ])("retains persisted Employee eligibility: %j", async (data) => {
        await prisma.employee.update({ where: { id: f.approver.employeeId }, data });
        try {
            await expect(getManagedHolidayCalendar(f.admin, f.year)).rejects.toMatchObject({ statusCode: 403 });
        } finally {
            await prisma.employee.update({ where: { id: f.approver.employeeId }, data: { status: "ACTIVE", deletedAt: null } });
        }
    });
});
