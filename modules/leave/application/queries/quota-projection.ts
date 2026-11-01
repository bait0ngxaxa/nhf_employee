import type { LeaveQuota } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ALL_LEAVE_TYPES, DEFAULT_LEAVE_QUOTA_HALF_DAYS } from "../../domain/constants";
import { calculateOpeningCarryBalanceHalfDays } from "../../domain/quota-accounting";
import { toLeaveQuotaDays } from "../../domain/half-days";

/** Mirrors ensureLeaveQuotaForYear without persisting initialization or reconciliation. */
export function projectLeaveQuotas(
    employeeId: number,
    year: number,
    records: readonly LeaveQuota[],
): Array<ReturnType<typeof toLeaveQuotaDays<LeaveQuota>>> {
    return ALL_LEAVE_TYPES.map((leaveType) => {
        const rows = records.filter((row) => row.employeeId === employeeId && row.leaveType === leaveType);
        const current = rows.find((row) => row.year === year);
        const previous = rows.filter((row) => row.year < year).sort((a, b) => b.year - a.year)[0];
        const totalHalfDays = DEFAULT_LEAVE_QUOTA_HALF_DAYS[leaveType];
        return toLeaveQuotaDays({
            id: current?.id ?? `projection-${year}-${leaveType}`,
            employeeId,
            year,
            leaveType,
            totalHalfDays,
            carryBalanceHalfDays: calculateOpeningCarryBalanceHalfDays({
                leaveType, totalHalfDays, targetYear: year, previousQuota: previous,
            }),
            usedHalfDays: current?.usedHalfDays ?? 0,
        });
    });
}

export async function getEmployeeLeaveQuotaProjection(
    employeeId: number,
    year: number,
): Promise<ReturnType<typeof projectLeaveQuotas>> {
    const records = await prisma.leaveQuota.findMany({
        where: { employeeId, year: { lte: year } },
    });
    return projectLeaveQuotas(employeeId, year, records);
}
