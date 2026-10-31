import { z } from "zod";
import type { LeavePeriod, LeaveStatus, LeaveType } from "@prisma/client";
import { calendarYearSchema } from "./holiday-calendar";

export const calendarImpactInputSchema = z
    .object({
        year: calendarYearSchema,
        versionId: z.string().min(1).max(191),
        cursor: z.string().min(1).max(191).optional(),
    })
    .strict();

export const calendarReconcileSchema = z
    .object({
        year: calendarYearSchema,
        leaveRequestId: z.string().min(1).max(191),
        calendarVersionId: z.string().min(1).max(191),
        expectedChargeHalfDays: z.number().int().nonnegative().max(732),
        reason: z.string().trim().min(5).max(1000),
        overQuotaJustification: z.string().trim().min(5).max(1000).optional(),
        confirmed: z.literal(true),
    })
    .strict();

export type CalendarReconcileInput = z.infer<typeof calendarReconcileSchema>;

export interface CalendarAdjustmentView {
    id: string;
    calendarVersionId: string;
    calendarVersion: number;
    previousHalfDays: number;
    resultingHalfDays: number;
    reason: string;
    overQuotaJustification: string | null;
    administratorId: number;
    administratorName: string;
    createdAt: string;
}

export interface CalendarImpactRow {
    id: string;
    employeeId: number;
    employeeName: string;
    leaveType: LeaveType;
    status: LeaveStatus;
    startDate: string;
    endDate: string;
    period: LeavePeriod;
    originalDurationHalfDays: number;
    calculationCalendarVersionId: string | null;
    approvalCalendarVersionId: string | null;
    chargedHalfDays: number;
    proposedDurationHalfDays: number;
    proposedChargeHalfDays: number;
    differenceHalfDays: number;
    validForNewRequest: boolean;
    action: "CANCEL_AND_RESUBMIT" | "RECONCILE" | "WAIT_CANCELLATION" | "NONE";
    adjustments: CalendarAdjustmentView[];
}

export interface CalendarImpactReport {
    year: number;
    activeVersionId: string | null;
    activeVersion: number | null;
    proposedVersionId: string;
    proposedVersion: number;
    proposedRevision: number;
    proposedPublished: boolean;
    addedHolidays: string[];
    removedHolidays: string[];
    rows: CalendarImpactRow[];
    nextCursor: string | null;
}

export interface CalendarReconcileResult {
    adjustment: CalendarAdjustmentView;
    replayed: boolean;
}
