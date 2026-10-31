import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { appendAuditInTransaction } from "@/modules/audit";
import { getEmployeeDisplayName } from "@/modules/employee";
import { calculateCalendarLeave } from "../../domain/calendar-calculation";
import { getEffectiveChargedHalfDays, isQuotaChargedStatus } from "../../domain/charged-units";
import { toDateOnlyString, toUtcDate } from "../../domain/business-date";
import { getLeaveDateRangeIssue } from "../../domain/utils";
import { HolidayCalendarError } from "../../domain/holiday-calendar";
import {
    calendarImpactInputSchema,
    calendarReconcileSchema,
    type CalendarAdjustmentView,
    type CalendarImpactReport,
    type CalendarImpactRow,
    type CalendarReconcileResult,
} from "../../domain/calendar-reconciliation";
import { calculateRemainingBalanceHalfDays } from "../../domain/quota-accounting";
import {
    ensureLeaveQuotaForYear,
    reconcileLeaveQuotaForward,
} from "../../domain/quota-entitlement";
import { lockLeaveRequestRow } from "../../infrastructure/persistence/transaction";
import { assertCalendarAdmin, type CalendarAdminContext } from "./authorization";
import { lockHolidayCalendar } from "./calendar";

const ADJUSTMENT_INCLUDE = {
    calendarVersion: { select: { number: true } },
    administrator: { select: { name: true } },
} as const satisfies Prisma.LeaveCalendarAdjustmentInclude;
type Adjustment = Prisma.LeaveCalendarAdjustmentGetPayload<{ include: typeof ADJUSTMENT_INCLUDE }>;

function projectAdjustment(row: Adjustment): CalendarAdjustmentView {
    return {
        id: row.id,
        calendarVersionId: row.calendarVersionId,
        calendarVersion: row.calendarVersion.number,
        previousHalfDays: row.previousHalfDays,
        resultingHalfDays: row.resultingHalfDays,
        reason: row.reason,
        overQuotaJustification: row.overQuotaJustification,
        administratorId: row.administratorId,
        administratorName: row.administrator.name,
        createdAt: row.createdAt.toISOString(),
    };
}

export async function getCalendarImpact(
    context: CalendarAdminContext,
    raw: unknown,
): Promise<CalendarImpactReport> {
    const parsed = calendarImpactInputSchema.safeParse(raw);
    if (!parsed.success) throw new HolidayCalendarError("ข้อมูลการตรวจผลกระทบไม่ถูกต้อง", 400);
    const input = parsed.data;
    return runSerializableTransaction(async (tx) => {
        await assertCalendarAdmin(tx, context);
        await lockHolidayCalendar(tx, input.year);
        const calendar = await tx.holidayCalendar.findUnique({
            where: { year: input.year },
            include: { activeVersion: { include: { days: true } } },
        });
        const proposed = await tx.holidayCalendarVersion.findFirst({
            where: { id: input.versionId, year: input.year },
            include: { days: true },
        });
        if (!proposed) throw new HolidayCalendarError("ไม่พบฉบับปฏิทิน", 404);
        const holidays = new Set(proposed.days.map((day) => toDateOnlyString(day.date)));
        const activeHolidays = new Set(
            (calendar?.activeVersion?.days ?? []).map((day) => toDateOnlyString(day.date)),
        );
        // Keyset pagination scans all relevant requests, including rows unaffected by changed individual dates.
        const requests = await tx.leaveRequest.findMany({
            where: {
                startDate: {
                    gte: toUtcDate(`${input.year}-01-01`),
                    lte: new Date(`${input.year}-12-31T23:59:59.999Z`),
                },
                ...(input.cursor ? { id: { gt: input.cursor } } : {}),
            },
            orderBy: { id: "asc" },
            take: 26,
            include: {
                employee: { select: { firstName: true, lastName: true, nickname: true } },
                calendarAdjustments: {
                    include: ADJUSTMENT_INCLUDE,
                    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
            },
        });
        const rows: CalendarImpactRow[] = requests.slice(0, 25).map((request) => {
            const calculation = calculateCalendarLeave(
                request.startDate,
                request.endDate,
                request.period,
                holidays,
            );
            const charge = getEffectiveChargedHalfDays(request);
            const pending = request.status === "PENDING";
            const proposedCharge = isQuotaChargedStatus(request.status)
                ? calculation.durationHalfDays
                : 0;
            const affected = pending
                ? !calculation.valid || calculation.durationHalfDays !== request.durationHalfDays
                : charge !== proposedCharge;
            return {
                id: request.id,
                employeeId: request.employeeId,
                employeeName: getEmployeeDisplayName(request.employee),
                leaveType: request.leaveType,
                status: request.status,
                startDate: toDateOnlyString(request.startDate),
                endDate: toDateOnlyString(request.endDate),
                period: request.period,
                originalDurationHalfDays: request.durationHalfDays,
                calculationCalendarVersionId: request.calculationCalendarVersionId,
                approvalCalendarVersionId: request.approvalCalendarVersionId,
                chargedHalfDays: charge,
                proposedDurationHalfDays: calculation.durationHalfDays,
                proposedChargeHalfDays: proposedCharge,
                differenceHalfDays: proposedCharge - charge,
                validForNewRequest: calculation.valid,
                action: !affected
                    ? "NONE"
                    : pending
                      ? "CANCEL_AND_RESUBMIT"
                      : request.status === "CANCELLATION_REQUESTED"
                        ? "WAIT_CANCELLATION"
                        : "RECONCILE",
                adjustments: request.calendarAdjustments.map(projectAdjustment),
            };
        });
        return {
            year: input.year,
            activeVersionId: calendar?.activeVersion?.id ?? null,
            activeVersion: calendar?.activeVersion?.number ?? null,
            proposedVersionId: proposed.id,
            proposedVersion: proposed.number,
            proposedRevision: proposed.revision,
            proposedPublished: proposed.publishedAt !== null,
            addedHolidays: [...holidays].filter((date) => !activeHolidays.has(date)).sort(),
            removedHolidays: [...activeHolidays].filter((date) => !holidays.has(date)).sort(),
            rows,
            nextCursor: requests.length > 25 ? rows[rows.length - 1].id : null,
        };
    });
}

export async function reconcileCalendarLeave(
    context: CalendarAdminContext,
    raw: unknown,
): Promise<CalendarReconcileResult> {
    const parsed = calendarReconcileSchema.safeParse(raw);
    if (!parsed.success)
        throw new HolidayCalendarError(
            "กรุณายืนยันและระบุเหตุผลการปรับโควต้าอย่างน้อย 5 ตัวอักษร",
            400,
        );
    const input = parsed.data;
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return runSerializableTransaction(async (tx) => {
        const actor = await assertCalendarAdmin(tx, context);
        await lockHolidayCalendar(tx, input.year);
        const calendar = await tx.holidayCalendar.findUnique({
            where: { year: input.year },
            include: { activeVersion: { include: { days: true } } },
        });
        const version = calendar?.activeVersion;
        if (!version || version.id !== input.calendarVersionId || !version.publishedAt)
            throw new HolidayCalendarError("ฉบับเผยแพร่เปลี่ยนแล้ว กรุณาตรวจผลกระทบใหม่");
        await lockLeaveRequestRow(tx, input.leaveRequestId);
        const request = await tx.leaveRequest.findUnique({ where: { id: input.leaveRequestId } });
        if (!request || Number(toDateOnlyString(request.startDate).slice(0, 4)) !== input.year)
            throw new HolidayCalendarError("ไม่พบคำขอลาในปีที่เลือก", 404);
        if (request.status !== "APPROVED")
            throw new HolidayCalendarError(
                "ปรับโควต้าได้เฉพาะคำขอที่อนุมัติแล้วและไม่ได้อยู่ระหว่างยกเลิก",
            );
        const existing = await tx.leaveCalendarAdjustment.findUnique({
            where: {
                leaveRequestId_calendarVersionId: {
                    leaveRequestId: request.id,
                    calendarVersionId: version.id,
                },
            },
            include: ADJUSTMENT_INCLUDE,
        });
        if (existing) {
            if (existing.confirmationHash !== hash)
                throw new HolidayCalendarError(
                    "ฉบับนี้ปรับโควต้าคำขอแล้วด้วยข้อมูลยืนยันอื่น กรุณาโหลดประวัติใหม่",
                );
            return { adjustment: projectAdjustment(existing), replayed: true };
        }
        const previous = getEffectiveChargedHalfDays(request);
        if (previous !== input.expectedChargeHalfDays)
            throw new HolidayCalendarError("ยอดหักโควต้าเปลี่ยนแล้ว กรุณาตรวจผลกระทบใหม่");
        const startDate = toDateOnlyString(request.startDate);
        const endDate = toDateOnlyString(request.endDate);
        if (getLeaveDateRangeIssue(startDate, endDate) || (request.period !== "FULL_DAY" && startDate !== endDate)) {
            throw new HolidayCalendarError("ช่วงวันลาเดิมไม่รองรับการคำนวณอัตโนมัติ กรุณาตรวจสอบประวัติข้อมูลก่อนปรับโควต้า");
        }
        const calculation = calculateCalendarLeave(
            request.startDate,
            request.endDate,
            request.period,
            new Set(version.days.map((day) => toDateOnlyString(day.date))),
        );
        const resulting = calculation.durationHalfDays;
        const difference = resulting - previous;
        if (difference === 0)
            throw new HolidayCalendarError("ยอดหักโควต้าตรงกับปฏิทินแล้ว ไม่ต้องปรับซ้ำ");
        const quota = await ensureLeaveQuotaForYear(tx, {
            employeeId: request.employeeId,
            year: input.year,
            leaveType: request.leaveType,
        });
        const scope = {
            employeeId: request.employeeId,
            leaveType: request.leaveType,
            year: { gte: input.year },
        };
        const beforeQuotas = await tx.leaveQuota.findMany({ where: scope });
        if (quota.usedHalfDays + difference < 0)
            throw new HolidayCalendarError(
                "ยอดโควต้าเดิมไม่สอดคล้อง กรุณาตรวจประวัติการหักก่อนปรับ",
            );
        const updatedQuota = await tx.leaveQuota.update({
            where: { id: quota.id },
            data: { usedHalfDays: { increment: difference } },
        });
        await reconcileLeaveQuotaForward(tx, updatedQuota);
        const afterQuotas = await tx.leaveQuota.findMany({ where: scope });
        const beforeExposure = new Map(
            beforeQuotas.map((row) => [
                row.year,
                Math.max(
                    0,
                    -calculateRemainingBalanceHalfDays(
                        row.totalHalfDays,
                        row.carryBalanceHalfDays,
                        row.usedHalfDays,
                    ),
                ),
            ]),
        );
        const exposureIncreases = afterQuotas.some(
            (row) =>
                Math.max(
                    0,
                    -calculateRemainingBalanceHalfDays(
                        row.totalHalfDays,
                        row.carryBalanceHalfDays,
                        row.usedHalfDays,
                    ),
                ) > (beforeExposure.get(row.year) ?? 0),
        );
        if (exposureIncreases && !input.overQuotaJustification)
            throw new HolidayCalendarError(
                "การปรับเพิ่มทำให้ใช้เกินสิทธิ์ในปีนี้หรือปีถัดไป กรุณาระบุเหตุผลพิเศษและยืนยันใหม่",
                409,
            );
        await tx.leaveRequest.update({
            where: { id: request.id },
            data: { chargedHalfDays: resulting },
        });
        const adjustment = await tx.leaveCalendarAdjustment.create({
            data: {
                leaveRequestId: request.id,
                calendarVersionId: version.id,
                previousHalfDays: previous,
                resultingHalfDays: resulting,
                reason: input.reason,
                overQuotaJustification: input.overQuotaJustification ?? null,
                confirmationHash: hash,
                administratorId: actor.id,
            },
            include: ADJUSTMENT_INCLUDE,
        });
        await appendAuditInTransaction(tx, {
            action: "LEAVE_CALENDAR_RECONCILE",
            entityType: "HolidayCalendar",
            entityId: input.year,
            userId: actor.id,
            userEmail: actor.email,
            details: {
                before: { chargedHalfDays: previous },
                after: { chargedHalfDays: resulting },
                metadata: {
                    leaveRequestId: request.id,
                    adjustmentId: adjustment.id,
                    calendarVersionId: version.id,
                    calendarVersion: version.number,
                    originalDurationHalfDays: request.durationHalfDays,
                    reason: input.reason,
                    overQuotaJustification: input.overQuotaJustification ?? null,
                    forwardQuotaYears: afterQuotas.map((row) => row.year),
                },
            },
        });
        return { adjustment: projectAdjustment(adjustment), replayed: false };
    });
}
