import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import {
    leaveAttachmentSummaryOrderBy,
    leaveAttachmentSummarySelect,
    type LeaveAttachmentUrlBuilder,
    withLeaveAttachmentSummaries,
} from "@/lib/services/leave/attachment-summary";
import {
    buildEmployeeLeaveHistoryFilterWhere,
    getAvailableLeaveHistoryYears,
    type LeaveHistoryFilters,
    type LeaveHistoryMetadata,
} from "@/lib/services/leave/history-filters";
import { toLeaveQuotaDays, toLeaveRequestDays } from "@/lib/services/leave/half-days";
import { ensureLeaveQuotasForYear } from "@/lib/services/leave/quota-entitlement";
import { getCurrentLeaveYear } from "@/lib/services/leave/quota-year";

const EMPLOYEE_LEAVE_HISTORY_INCLUDE = {
    approver: {
        select: {
            firstName: true,
            lastName: true,
            nickname: true,
        },
    },
    attachments: {
        select: leaveAttachmentSummarySelect,
        orderBy: leaveAttachmentSummaryOrderBy,
    },
} as const satisfies Prisma.LeaveRequestInclude;

type StoredEmployeeLeaveRequest = Prisma.LeaveRequestGetPayload<{
    include: typeof EMPLOYEE_LEAVE_HISTORY_INCLUDE;
}>;
type StoredLeaveQuota = Prisma.LeaveQuotaGetPayload<Record<string, never>>;
type EmployeeLeaveRequestWithAttachments = ReturnType<
    typeof withLeaveAttachmentSummaries<StoredEmployeeLeaveRequest>
>;

export interface EmployeeLeaveProfileData {
    quotas: Array<ReturnType<typeof toLeaveQuotaDays<StoredLeaveQuota>>>;
    history: Array<ReturnType<typeof toLeaveRequestDays<EmployeeLeaveRequestWithAttachments>>>;
    metadata: LeaveHistoryMetadata;
}

export interface EmployeeLeaveProfileQuery {
    employeeId: number;
    page: number;
    limit: number;
    filters: LeaveHistoryFilters;
    buildAttachmentUrl?: LeaveAttachmentUrlBuilder;
}

export async function getEmployeeLeaveProfile(
    input: EmployeeLeaveProfileQuery,
): Promise<EmployeeLeaveProfileData> {
    const employeeHistoryScopeWhere: Prisma.LeaveRequestWhereInput = {
        employeeId: input.employeeId,
    };
    const historyFilterWhere = buildEmployeeLeaveHistoryFilterWhere(input.filters);
    const where: Prisma.LeaveRequestWhereInput = {
        ...employeeHistoryScopeWhere,
        ...(historyFilterWhere ?? {}),
    };
    const quotas = await runSerializableTransaction((tx) =>
        ensureLeaveQuotasForYear(tx, input.employeeId, getCurrentLeaveYear()),
    );
    const skip = (input.page - 1) * input.limit;
    const [history, totalCount, availableYearRange] = await Promise.all([
        prisma.leaveRequest.findMany({
            where,
            skip,
            take: input.limit,
            orderBy: { createdAt: "desc" },
            include: EMPLOYEE_LEAVE_HISTORY_INCLUDE,
        }),
        prisma.leaveRequest.count({ where }),
        prisma.leaveRequest.aggregate({
            where: employeeHistoryScopeWhere,
            _min: { startDate: true },
            _max: { startDate: true },
        }),
    ]);

    return {
        quotas: quotas.map(toLeaveQuotaDays),
        history: history.map((request) =>
            toLeaveRequestDays(
                withLeaveAttachmentSummaries(request, input.buildAttachmentUrl),
            ),
        ),
        metadata: {
            currentPage: input.page,
            totalPages: Math.ceil(totalCount / input.limit),
            totalItems: totalCount,
            itemsPerPage: input.limit,
            availableYears: getAvailableLeaveHistoryYears(
                availableYearRange._min.startDate,
                availableYearRange._max.startDate,
            ),
        },
    };
}
