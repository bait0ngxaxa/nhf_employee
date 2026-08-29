import {
    EmployeeStatus,
    type LeaveQuota,
    type LeaveType,
    type Prisma,
} from "@prisma/client";

import { ALL_LEAVE_TYPES } from "@/constants/leave";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { prisma } from "@/lib/db/prisma";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import type { LeaveReportEmployee } from "@/lib/services/leave/report-types";
import { createLeaveReportWorkbook } from "@/lib/services/leave/report-workbook";
import {
    getCurrentLeaveYear,
    getLeaveYearFromDateValue,
} from "@/lib/services/leave/quota-year";
import {
    signedHalfDaysToDays,
    toLeaveRequestDays,
} from "@/lib/services/leave/half-days";
import { calculateEffectiveEntitlementForYearHalfDays } from "@/lib/services/leave/quota-entitlement";
import {
    getApproverHistoryReportWhere,
    LEAVE_REPORT_STATUSES,
} from "@/lib/services/leave/approval-queries";
import {
    DEFAULT_LEAVE_REPORT_SCOPE,
    type LeaveReportScope,
} from "@/lib/validations/leave-report";

export type LeaveReportMeta = {
    year: number;
    scope: LeaveReportScope;
    employeeCount: number;
    requestCount: number;
    maxRows: number;
};

export async function getLeaveReportYears(
    currentEmployeeId: number,
    scope: LeaveReportScope = DEFAULT_LEAVE_REPORT_SCOPE,
): Promise<number[]> {
    const rows = scope === "approver-history"
        ? await getApproverHistoryReportYears(currentEmployeeId)
        : await getCurrentTeamReportYears(currentEmployeeId);

    const yearSet = new Set(rows.map((row) => getLeaveYearFromDateValue(row.startDate)));
    yearSet.add(getCurrentLeaveYear());
    return Array.from(yearSet).sort((a, b) => b - a);
}

export async function getApproverHistoryReportYears(
    currentEmployeeId: number,
): Promise<Array<{ startDate: Date }>> {
    return prisma.leaveRequest.findMany({
        where: getApproverHistoryReportWhere(currentEmployeeId),
        select: { startDate: true },
        distinct: ["startDate"],
    });
}

export async function getCurrentTeamReportYears(
    currentEmployeeId: number,
): Promise<Array<{ startDate: Date }>> {
    return prisma.leaveRequest.findMany({
        where: {
            employee: {
                managerId: currentEmployeeId,
                status: EmployeeStatus.ACTIVE,
                deletedAt: null,
            },
            status: { in: LEAVE_REPORT_STATUSES },
        },
        select: { startDate: true },
        distinct: ["startDate"],
    });
}

export async function getLeaveReportMeta(
    currentEmployeeId: number,
    year: number,
    scope: LeaveReportScope = DEFAULT_LEAVE_REPORT_SCOPE,
): Promise<LeaveReportMeta> {
    return scope === "approver-history"
        ? getApproverHistoryReportMeta(currentEmployeeId, year)
        : getCurrentTeamReportMeta(currentEmployeeId, year);
}

export async function createLeaveReportXlsxResponse(
    currentEmployeeId: number,
    year: number,
    scope: LeaveReportScope = DEFAULT_LEAVE_REPORT_SCOPE,
): Promise<Response> {
    const employees = scope === "approver-history"
        ? await loadApproverHistoryReportEmployees(currentEmployeeId, year)
        : await loadCurrentTeamReportEmployees(currentEmployeeId, year);
    const workbook = createLeaveReportWorkbook(employees, {
        includeSummarySheet: scope === "current-team",
    });
    const reportName = scope === "approver-history"
        ? "ประวัติการอนุมัติการลา"
        : "รายงานสรุปการลา";
    const filename = generateFilename(`${reportName}_ปี-${year}`, "xlsx");
    return createXlsxDownloadResponse(filename, workbook);
}

export async function getApproverHistoryReportMeta(
    currentEmployeeId: number,
    year: number,
): Promise<LeaveReportMeta> {
    const [employeeRows, requestCount] = await Promise.all([
        prisma.leaveRequest.findMany({
            where: createApproverHistoryWhere(currentEmployeeId, year),
            select: { employeeId: true },
            distinct: ["employeeId"],
        }),
        countApproverHistoryRequests(currentEmployeeId, year),
    ]);

    return {
        year,
        scope: "approver-history",
        employeeCount: employeeRows.length,
        requestCount,
        maxRows: EXPORT_LIMITS.leave.maxRows,
    };
}

export async function getCurrentTeamReportMeta(
    currentEmployeeId: number,
    year: number,
): Promise<LeaveReportMeta> {
    const [employeeCount, requestCount] = await Promise.all([
        countCurrentTeamEmployees(currentEmployeeId),
        countCurrentTeamRequests(currentEmployeeId, year),
    ]);

    return {
        year,
        scope: "current-team",
        employeeCount,
        requestCount,
        maxRows: EXPORT_LIMITS.leave.maxRows,
    };
}

async function countCurrentTeamEmployees(currentEmployeeId: number): Promise<number> {
    return prisma.employee.count({
        where: {
            managerId: currentEmployeeId,
            status: EmployeeStatus.ACTIVE,
            deletedAt: null,
        },
    });
}

async function countCurrentTeamRequests(
    currentEmployeeId: number,
    year: number,
): Promise<number> {
    return prisma.leaveRequest.count({
        where: createCurrentTeamRequestWhere(currentEmployeeId, year),
    });
}

async function countApproverHistoryRequests(
    currentEmployeeId: number,
    year: number,
): Promise<number> {
    return prisma.leaveRequest.count({
        where: createApproverHistoryWhere(currentEmployeeId, year),
    });
}

export async function loadCurrentTeamReportEmployees(
    currentEmployeeId: number,
    year: number,
): Promise<LeaveReportEmployee[]> {
    const { startOfYear, endOfYear } = createYearRange(year);
    const employees = await prisma.employee.findMany({
        where: {
            managerId: currentEmployeeId,
            status: EmployeeStatus.ACTIVE,
            deletedAt: null,
        },
        select: {
            ...createEmployeeReportSelect(year),
            leaveRequests: {
                where: {
                    startDate: { gte: startOfYear, lt: endOfYear },
                    status: { in: LEAVE_REPORT_STATUSES },
                },
                select: createLeaveRequestReportSelect(),
            },
        },
    });

    return employees.map((employee) => ({
        ...employee,
        leaveQuotas: toLeaveReportQuotaDays(employee.leaveQuotas, year),
        leaveRequests: employee.leaveRequests.map(toLeaveRequestDays),
    }));
}

export async function loadApproverHistoryReportEmployees(
    currentEmployeeId: number,
    year: number,
): Promise<LeaveReportEmployee[]> {
    const requests = await prisma.leaveRequest.findMany({
        where: createApproverHistoryWhere(currentEmployeeId, year),
        select: {
            ...createLeaveRequestReportSelect(),
            employee: {
                select: createEmployeeReportSelect(year),
            },
        },
    });

    const employees = new Map<number, LeaveReportEmployee>();
    for (const request of requests) {
        const existingEmployee = employees.get(request.employee.id);
        const reportRequest = toLeaveRequestDays(request);

        if (existingEmployee) {
            existingEmployee.leaveRequests.push(reportRequest);
            continue;
        }

        employees.set(request.employee.id, {
            ...request.employee,
            leaveQuotas: toLeaveReportQuotaDays(
                request.employee.leaveQuotas,
                year,
            ),
            leaveRequests: [reportRequest],
        });
    }

    return Array.from(employees.values());
}

function createApproverHistoryWhere(
    currentEmployeeId: number,
    year: number,
): Prisma.LeaveRequestWhereInput {
    const { startOfYear, endOfYear } = createYearRange(year);
    return {
        ...getApproverHistoryReportWhere(currentEmployeeId),
        startDate: { gte: startOfYear, lt: endOfYear },
    };
}

function createCurrentTeamRequestWhere(
    currentEmployeeId: number,
    year: number,
): Prisma.LeaveRequestWhereInput {
    const { startOfYear, endOfYear } = createYearRange(year);
    return {
        employee: {
            managerId: currentEmployeeId,
            status: EmployeeStatus.ACTIVE,
            deletedAt: null,
        },
        startDate: { gte: startOfYear, lt: endOfYear },
        status: { in: LEAVE_REPORT_STATUSES },
    };
}

function createEmployeeReportSelect(year: number) {
    return {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        position: true,
        dept: { select: { name: true } },
        leaveQuotas: {
            where: { year: { lte: year } },
            select: {
                leaveType: true,
                year: true,
                totalHalfDays: true,
                carryBalanceHalfDays: true,
                usedHalfDays: true,
            },
        },
    } as const;
}

type LeaveReportQuotaSnapshot = Pick<
    LeaveQuota,
    | "leaveType"
    | "year"
    | "totalHalfDays"
    | "carryBalanceHalfDays"
    | "usedHalfDays"
>;

function toLeaveReportQuotaDays(
    quotas: readonly LeaveReportQuotaSnapshot[],
    year: number,
): LeaveReportEmployee["leaveQuotas"] {
    const latestByType = new Map<LeaveType, LeaveReportQuotaSnapshot>();
    for (const quota of quotas) {
        const currentLatest = latestByType.get(quota.leaveType);
        if (!currentLatest || quota.year > currentLatest.year) {
            latestByType.set(quota.leaveType, quota);
        }
    }

    return ALL_LEAVE_TYPES.map((leaveType) => ({
        leaveType,
        effectiveTotalDays: signedHalfDaysToDays(
            calculateEffectiveEntitlementForYearHalfDays({
                leaveType,
                year,
                latestQuota: latestByType.get(leaveType),
            }),
        ),
    }));
}

function createLeaveRequestReportSelect() {
    return {
        id: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        period: true,
        durationHalfDays: true,
        reason: true,
        emergencyReason: true,
        specialReason: true,
        overQuotaHalfDays: true,
        status: true,
        rejectReason: true,
        notTakenReason: true,
        createdAt: true,
    } as const;
}

function createYearRange(year: number): { startOfYear: Date; endOfYear: Date } {
    return {
        startOfYear: new Date(`${year}-01-01T00:00:00.000Z`),
        endOfYear: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
}
