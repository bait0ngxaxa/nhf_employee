import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { getCurrentLeaveYear } from "@/lib/services/leave/quota-year";
import { toLeaveQuotaDays, toLeaveRequestDays } from "@/lib/services/leave/half-days";
import { ensureLeaveQuotasForYear } from "@/lib/services/leave/quota-entitlement";
import {
    buildEmployeeLeaveHistoryFilterWhere,
    getAvailableLeaveHistoryYears,
    parseEmployeeLeaveHistoryFilters,
} from "@/lib/services/leave/history-filters";
import {
    leaveAttachmentSummaryOrderBy,
    leaveAttachmentSummarySelect,
    withLeaveAttachmentSummaries,
} from "@/lib/services/leave/attachment-summary";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const LEAVE_PAGINATION_MESSAGES = {
    invalidPage: "หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1",
    invalidLimit: "จำนวนรายการต่อหน้าต้องอยู่ระหว่าง 1 ถึง 50",
} as const;

export async function GET(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const { employeeId } = auth;

        const url = new URL(req.url);
        const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10);

        if (!Number.isInteger(page) || page < 1) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidPage, 400);
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidLimit, 400);
        }

        const filtersResult = parseEmployeeLeaveHistoryFilters(url);
        if (!filtersResult.success) {
            return jsonError(filtersResult.error, 400);
        }

        const employeeHistoryScopeWhere: Prisma.LeaveRequestWhereInput = {
            employeeId,
        };
        const historyFilterWhere = buildEmployeeLeaveHistoryFilterWhere(
            filtersResult.filters,
        );
        const where: Prisma.LeaveRequestWhereInput = {
            ...employeeHistoryScopeWhere,
            ...(historyFilterWhere ?? {}),
        };

        const currentYear = getCurrentLeaveYear();
        const quotas = await runSerializableTransaction((tx) =>
            ensureLeaveQuotasForYear(tx, employeeId, currentYear),
        );

        const skip = (page - 1) * limit;

        const [history, totalCount, availableYearRange] = await Promise.all([
            prisma.leaveRequest.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
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
                },
            }),
            prisma.leaveRequest.count({ where }),
            prisma.leaveRequest.aggregate({
                where: employeeHistoryScopeWhere,
                _min: { startDate: true },
                _max: { startDate: true },
            }),
        ]);

        return NextResponse.json({
            quotas: quotas.map(toLeaveQuotaDays),
            history: history.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            metadata: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: limit,
                availableYears: getAvailableLeaveHistoryYears(
                    availableYearRange._min.startDate,
                    availableYearRange._max.startDate,
                ),
            },
        });
    } catch (error) {
        console.error("Error fetching leave data:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchLeaveData, 500);
    }
}
