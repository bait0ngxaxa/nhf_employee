import type { LeaveStatus, LeaveType } from "@prisma/client";

import { ALL_LEAVE_TYPES, DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import {
    LEAVE_PERIOD_TH,
    LEAVE_STATUS_TH,
    LEAVE_TYPE_TH,
} from "@/lib/helpers/csv-helpers";
import type {
    LeaveDetailRow,
    LeaveReportEmployee,
    LeaveReportQuota,
    LeaveReportRequest,
    LeaveReportRows,
    LeaveSummaryRow,
} from "@/lib/services/leave/report-types";

type LeaveTypeTotals = Record<LeaveType, number>;

export function buildLeaveReportRows(employees: LeaveReportEmployee[]): LeaveReportRows {
    const sortedEmployees = [...employees].sort(compareEmployees);
    const summaryRows = sortedEmployees.map(buildSummaryRow);
    const detailRows = sortedEmployees.flatMap(buildDetailRows);

    return {
        summaryRows: [...summaryRows, buildTeamTotalRow(summaryRows)],
        detailRows,
    };
}

function buildSummaryRow(employee: LeaveReportEmployee): LeaveSummaryRow {
    const quotas = getQuotaTotals(employee.leaveQuotas);
    const used = getApprovedUsedTotals(employee.leaveRequests);
    const pending = getPendingTotals(employee.leaveRequests);
    const totalUsed = sumLeaveTypeTotals(used);
    const totalQuota = sumLeaveTypeTotals(quotas);

    return {
        employeeName: formatEmployeeName(employee),
        department: employee.dept?.name ?? "-",
        position: employee.position,
        sickQuota: quotas.SICK,
        sickUsed: used.SICK,
        sickRemaining: quotas.SICK - used.SICK,
        personalQuota: quotas.PERSONAL,
        personalUsed: used.PERSONAL,
        personalRemaining: quotas.PERSONAL - used.PERSONAL,
        vacationQuota: quotas.VACATION,
        vacationUsed: used.VACATION,
        vacationRemaining: quotas.VACATION - used.VACATION,
        totalUsed,
        totalRemaining: totalQuota - totalUsed,
        overQuotaDays: sumApprovedOverQuotaDays(employee.leaveRequests),
        pendingDays: pending.days,
        approvedRequestCount: countStatus(employee.leaveRequests, "APPROVED"),
        pendingRequestCount: pending.count,
        inactiveRequestCount: countInactiveRequests(employee.leaveRequests),
        notTakenCount: countStatus(employee.leaveRequests, "NOT_TAKEN"),
        latestApprovedDate: findLatestApprovedDate(employee.leaveRequests),
    };
}

function buildDetailRows(employee: LeaveReportEmployee): LeaveDetailRow[] {
    const sortedRequests = [...employee.leaveRequests].sort(compareRequests);
    return sortedRequests.map((request) => ({
        employeeName: formatEmployeeName(employee),
        department: employee.dept?.name ?? "-",
        position: employee.position,
        leaveType: LEAVE_TYPE_TH[request.leaveType] ?? request.leaveType,
        startDate: request.startDate,
        endDate: request.endDate,
        period: LEAVE_PERIOD_TH[request.period] ?? request.period,
        status: LEAVE_STATUS_TH[request.status] ?? request.status,
        requestedDays: request.durationDays,
        effectiveDays: getEffectiveLeaveDays(request),
        overQuotaDays: request.status === "APPROVED" ? request.overQuotaDays : 0,
        reason: request.reason,
        emergencyReason: request.emergencyReason ?? "-",
        specialReason: request.specialReason ?? "-",
        rejectReason: request.rejectReason ?? "-",
        notTakenReason: request.notTakenReason ?? "-",
        createdAt: request.createdAt,
    }));
}

function buildTeamTotalRow(rows: LeaveSummaryRow[]): LeaveSummaryRow {
    return rows.reduce<LeaveSummaryRow>(
        (total, row) => ({
            ...total,
            sickQuota: total.sickQuota + row.sickQuota,
            sickUsed: total.sickUsed + row.sickUsed,
            sickRemaining: total.sickRemaining + row.sickRemaining,
            personalQuota: total.personalQuota + row.personalQuota,
            personalUsed: total.personalUsed + row.personalUsed,
            personalRemaining: total.personalRemaining + row.personalRemaining,
            vacationQuota: total.vacationQuota + row.vacationQuota,
            vacationUsed: total.vacationUsed + row.vacationUsed,
            vacationRemaining: total.vacationRemaining + row.vacationRemaining,
            totalUsed: total.totalUsed + row.totalUsed,
            totalRemaining: total.totalRemaining + row.totalRemaining,
            overQuotaDays: total.overQuotaDays + row.overQuotaDays,
            pendingDays: total.pendingDays + row.pendingDays,
            approvedRequestCount: total.approvedRequestCount + row.approvedRequestCount,
            pendingRequestCount: total.pendingRequestCount + row.pendingRequestCount,
            inactiveRequestCount: total.inactiveRequestCount + row.inactiveRequestCount,
            notTakenCount: total.notTakenCount + row.notTakenCount,
        }),
        createEmptyTeamTotalRow(),
    );
}

function createEmptyTeamTotalRow(): LeaveSummaryRow {
    return {
        employeeName: "รวมทั้งทีม",
        department: "-",
        position: "-",
        sickQuota: 0,
        sickUsed: 0,
        sickRemaining: 0,
        personalQuota: 0,
        personalUsed: 0,
        personalRemaining: 0,
        vacationQuota: 0,
        vacationUsed: 0,
        vacationRemaining: 0,
        totalUsed: 0,
        totalRemaining: 0,
        overQuotaDays: 0,
        pendingDays: 0,
        approvedRequestCount: 0,
        pendingRequestCount: 0,
        inactiveRequestCount: 0,
        notTakenCount: 0,
        latestApprovedDate: null,
    };
}

function getQuotaTotals(quotas: LeaveReportQuota[]): LeaveTypeTotals {
    const totals = createDefaultQuotaTotals();
    for (const quota of quotas) {
        totals[quota.leaveType] = quota.totalDays;
    }
    return totals;
}

function getApprovedUsedTotals(requests: LeaveReportRequest[]): LeaveTypeTotals {
    const totals = createEmptyLeaveTypeTotals();
    for (const request of requests) {
        if (request.status === "APPROVED") {
            totals[request.leaveType] += request.durationDays;
        }
    }
    return totals;
}

function getPendingTotals(requests: LeaveReportRequest[]): { count: number; days: number } {
    return requests.reduce(
        (total, request) =>
            request.status === "PENDING"
                ? { count: total.count + 1, days: total.days + request.durationDays }
                : total,
        { count: 0, days: 0 },
    );
}

function createDefaultQuotaTotals(): LeaveTypeTotals {
    return Object.fromEntries(
        ALL_LEAVE_TYPES.map((type) => [type, DEFAULT_LEAVE_QUOTAS[type]]),
    ) as LeaveTypeTotals;
}

function createEmptyLeaveTypeTotals(): LeaveTypeTotals {
    return Object.fromEntries(ALL_LEAVE_TYPES.map((type) => [type, 0])) as LeaveTypeTotals;
}

function sumLeaveTypeTotals(totals: LeaveTypeTotals): number {
    return ALL_LEAVE_TYPES.reduce((sum, type) => sum + totals[type], 0);
}

function sumApprovedOverQuotaDays(requests: LeaveReportRequest[]): number {
    return requests.reduce(
        (sum, request) => sum + (request.status === "APPROVED" ? request.overQuotaDays : 0),
        0,
    );
}

function countStatus(requests: LeaveReportRequest[], status: LeaveStatus): number {
    return requests.filter((request) => request.status === status).length;
}

function countInactiveRequests(requests: LeaveReportRequest[]): number {
    return requests.filter((request) => ["REJECTED", "CANCELLED"].includes(request.status)).length;
}

function findLatestApprovedDate(requests: LeaveReportRequest[]): Date | null {
    const approvedDates = requests
        .filter((request) => request.status === "APPROVED")
        .map((request) => request.startDate.getTime());

    return approvedDates.length > 0 ? new Date(Math.max(...approvedDates)) : null;
}

function getEffectiveLeaveDays(request: LeaveReportRequest): number {
    return request.status === "APPROVED" ? request.durationDays : 0;
}

function compareEmployees(left: LeaveReportEmployee, right: LeaveReportEmployee): number {
    return compareText(left.dept?.name, right.dept?.name)
        || compareText(left.firstName, right.firstName)
        || compareText(left.lastName, right.lastName)
        || left.id - right.id;
}

function compareRequests(left: LeaveReportRequest, right: LeaveReportRequest): number {
    return left.startDate.getTime() - right.startDate.getTime()
        || left.status.localeCompare(right.status)
        || left.id.localeCompare(right.id);
}

function compareText(left: string | null | undefined, right: string | null | undefined): number {
    return (left ?? "").localeCompare(right ?? "", "th");
}

function formatEmployeeName(
    employee: Pick<LeaveReportEmployee, "firstName" | "lastName" | "nickname">,
): string {
    const nickname = employee.nickname ? ` (${employee.nickname})` : "";
    return `${employee.firstName} ${employee.lastName}${nickname}`;
}
