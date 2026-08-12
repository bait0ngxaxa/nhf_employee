import { NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { getCurrentLeaveYear } from "@/lib/services/leave/quota-year";
import { toLeaveQuotaDays, toLeaveRequestDays } from "@/lib/services/leave/half-days";
import { ensureLeaveQuotasForYear } from "@/lib/services/leave/quota-entitlement";
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

export async function GET(req: Request) {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const { employeeId } = auth;

        const currentYear = getCurrentLeaveYear();
        const quotas = await runSerializableTransaction((tx) =>
            ensureLeaveQuotasForYear(tx, employeeId, currentYear),
        );

        const url = new URL(req.url);
        const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10);

        if (!Number.isInteger(page) || page < 1) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidPage, 400);
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidLimit, 400);
        }

        const skip = (page - 1) * limit;

        const [history, totalCount] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: { employeeId },
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
            prisma.leaveRequest.count({ where: { employeeId } }),
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
            },
        });
    } catch (error) {
        console.error("Error fetching leave data:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchLeaveData, 500);
    }
}
