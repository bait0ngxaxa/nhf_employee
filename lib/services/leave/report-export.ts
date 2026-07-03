import { EmployeeStatus, type LeaveStatus } from "@prisma/client";

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

export type LeaveReportMeta = {
    year: number;
    employeeCount: number;
    requestCount: number;
    maxRows: number;
};

const REPORT_STATUSES: LeaveStatus[] = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "NOT_TAKEN",
];

export async function getLeaveReportYears(managerId: number): Promise<number[]> {
    const rows = await prisma.leaveRequest.findMany({
        where: {
            employee: {
                managerId,
                status: EmployeeStatus.ACTIVE,
                deletedAt: null,
            },
        },
        select: { startDate: true },
        distinct: ["startDate"],
    });
    const yearSet = new Set(rows.map((row) => getLeaveYearFromDateValue(row.startDate)));
    yearSet.add(getCurrentLeaveYear());
    return Array.from(yearSet).sort((a, b) => b - a);
}

export async function getLeaveReportMeta(
    managerId: number,
    year: number,
): Promise<LeaveReportMeta> {
    const [employeeCount, requestCount] = await Promise.all([
        countCurrentTeamEmployees(managerId),
        countCurrentTeamRequests(managerId, year),
    ]);

    return {
        year,
        employeeCount,
        requestCount,
        maxRows: EXPORT_LIMITS.leave.maxRows,
    };
}

export async function createLeaveReportXlsxResponse(
    managerId: number,
    year: number,
): Promise<Response> {
    const employees = await loadLeaveReportEmployees(managerId, year);
    const workbook = createLeaveReportWorkbook(employees);
    const filename = generateFilename(`รายงานสรุปการลา_ปี-${year}`, "xlsx");
    return createXlsxDownloadResponse(filename, workbook);
}

async function countCurrentTeamEmployees(managerId: number): Promise<number> {
    return prisma.employee.count({
        where: {
            managerId,
            status: EmployeeStatus.ACTIVE,
            deletedAt: null,
        },
    });
}

async function countCurrentTeamRequests(managerId: number, year: number): Promise<number> {
    const { startOfYear, endOfYear } = createYearRange(year);
    return prisma.leaveRequest.count({
        where: {
            employee: {
                managerId,
                status: EmployeeStatus.ACTIVE,
                deletedAt: null,
            },
            startDate: { gte: startOfYear, lt: endOfYear },
            status: { in: REPORT_STATUSES },
        },
    });
}

async function loadLeaveReportEmployees(
    managerId: number,
    year: number,
): Promise<LeaveReportEmployee[]> {
    const { startOfYear, endOfYear } = createYearRange(year);
    return prisma.employee.findMany({
        where: {
            managerId,
            status: EmployeeStatus.ACTIVE,
            deletedAt: null,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            position: true,
            dept: { select: { name: true } },
            leaveQuotas: {
                where: { year },
                select: { leaveType: true, totalDays: true },
            },
            leaveRequests: {
                where: {
                    startDate: { gte: startOfYear, lt: endOfYear },
                    status: { in: REPORT_STATUSES },
                },
                select: {
                    id: true,
                    leaveType: true,
                    startDate: true,
                    endDate: true,
                    period: true,
                    durationDays: true,
                    reason: true,
                    emergencyReason: true,
                    specialReason: true,
                    overQuotaDays: true,
                    status: true,
                    rejectReason: true,
                    notTakenReason: true,
                    createdAt: true,
                },
            },
        },
    });
}

function createYearRange(year: number): { startOfYear: Date; endOfYear: Date } {
    return {
        startOfYear: new Date(`${year}-01-01T00:00:00.000Z`),
        endOfYear: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
}
