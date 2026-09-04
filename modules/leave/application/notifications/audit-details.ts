import type { LeaveAuditContext } from "@/lib/audit-log/contracts";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { halfDaysToDays } from "@/modules/leave/domain/half-days";

type LeaveAuditSource = {
    id: string;
    employeeId: number;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    startDate: Date | string;
    endDate: Date | string;
    period: "FULL_DAY" | "MORNING" | "AFTERNOON";
    durationHalfDays: number;
    employee?: {
        firstName: string;
        lastName: string;
        nickname?: string | null;
    };
};

type LeaveAuditContextOptions = {
    employeeName?: string;
    attachmentCount?: number;
    reason?: string | null;
};

function toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
}

export function buildLeaveAuditContext(
    request: LeaveAuditSource,
    options: LeaveAuditContextOptions = {},
): LeaveAuditContext {
    const employeeName = options.employeeName
        ?? (request.employee
            ? getEmployeeDisplayName(request.employee)
            : undefined);

    return {
        leaveRequestId: request.id,
        employeeId: request.employeeId,
        ...(employeeName ? { employeeName } : {}),
        leaveType: request.leaveType,
        startDate: toIsoString(request.startDate),
        endDate: toIsoString(request.endDate),
        period: request.period,
        durationDays: halfDaysToDays(request.durationHalfDays),
        ...(options.attachmentCount === undefined
            ? {}
            : { attachmentCount: options.attachmentCount }),
        ...(options.reason === undefined ? {} : { reason: options.reason }),
    };
}
