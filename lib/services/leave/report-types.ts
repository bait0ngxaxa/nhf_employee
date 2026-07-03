import type { LeavePeriod, LeaveStatus, LeaveType } from "@prisma/client";

export type LeaveReportQuota = {
    leaveType: LeaveType;
    totalDays: number;
};

export type LeaveReportRequest = {
    id: string;
    leaveType: LeaveType;
    startDate: Date;
    endDate: Date;
    period: LeavePeriod;
    durationDays: number;
    reason: string;
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
    status: LeaveStatus;
    rejectReason: string | null;
    notTakenReason: string | null;
    createdAt: Date;
};

export type LeaveReportEmployee = {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    position: string;
    dept: { name: string } | null;
    leaveQuotas: LeaveReportQuota[];
    leaveRequests: LeaveReportRequest[];
};

export type LeaveSummaryRow = {
    employeeName: string;
    department: string;
    position: string;
    sickQuota: number;
    sickUsed: number;
    sickRemaining: number;
    personalQuota: number;
    personalUsed: number;
    personalRemaining: number;
    vacationQuota: number;
    vacationUsed: number;
    vacationRemaining: number;
    totalUsed: number;
    totalRemaining: number;
    overQuotaDays: number;
    pendingDays: number;
    approvedRequestCount: number;
    pendingRequestCount: number;
    inactiveRequestCount: number;
    notTakenCount: number;
    latestApprovedDate: Date | null;
};

export type LeaveDetailRow = {
    employeeName: string;
    department: string;
    position: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    period: string;
    status: string;
    requestedDays: number;
    effectiveDays: number;
    overQuotaDays: number;
    reason: string;
    emergencyReason: string;
    specialReason: string;
    rejectReason: string;
    notTakenReason: string;
    createdAt: Date;
};

export type LeaveReportRows = {
    summaryRows: LeaveSummaryRow[];
    detailRows: LeaveDetailRow[];
};
