import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";
import {
    createLeaveApprovalMetadata,
    getAssignedLeaveApproverWhere,
    LEAVE_APPROVALS_PAGE_SIZE,
    LEAVE_APPROVAL_REQUEST_INCLUDE,
    parseLeaveApprovalPage,
} from "@/lib/services/leave/approval-queries";
import {
    withLeaveAttachmentSummaries,
} from "@/lib/services/leave/attachment-summary";

const APPROVALS_PAGINATION_MESSAGES = {
    invalidPage: "หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1",
} as const;

export async function GET(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const managerId = auth.employeeId;

        const url = new URL(req.url);
        const pendingPage = parseLeaveApprovalPage(url, "pendingPage");
        const notTakenPage = parseLeaveApprovalPage(url, "notTakenPage");
        const historyPage = parseLeaveApprovalPage(url, "historyPage");
        const cancellationPage = parseLeaveApprovalPage(url, "cancellationPage");
        if (!pendingPage || !notTakenPage || !historyPage || !cancellationPage) {
            return NextResponse.json(
                { error: APPROVALS_PAGINATION_MESSAGES.invalidPage },
                { status: 400 },
            );
        }

        const assignedApproverWhere = getAssignedLeaveApproverWhere(managerId);
        const pendingWhere: Prisma.LeaveRequestWhereInput = {
            ...assignedApproverWhere,
            status: "PENDING",
        };
        const exceptionActionApproverWhere = assignedApproverWhere;
        const notTakenWhere: Prisma.LeaveRequestWhereInput = {
            ...exceptionActionApproverWhere,
            status: "APPROVED",
            notTakenRequestedAt: { not: null },
            notTakenConfirmedAt: null,
        };
        const historyWhere: Prisma.LeaveRequestWhereInput = {
            AND: [
                assignedApproverWhere,
                {
                    OR: [
                        { status: { in: ["REJECTED", "NOT_TAKEN", "CANCELLED_AFTER_APPROVAL"] } },
                        {
                            status: "APPROVED",
                            OR: [
                                { notTakenRequestedAt: null },
                                { notTakenConfirmedAt: { not: null } },
                            ],
                        },
                    ],
                },
            ],
        };
        const cancellationWhere: Prisma.LeaveRequestWhereInput = {
            ...exceptionActionApproverWhere,
            status: "CANCELLATION_REQUESTED",
        };

        const [
            pendingApprovals,
            pendingCount,
            notTakenPending,
            notTakenCount,
            approvalHistory,
            historyCount,
            cancellationPending,
            cancellationCount,
        ] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: pendingWhere,
                skip: (pendingPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
                take: LEAVE_APPROVALS_PAGE_SIZE,
                orderBy: {
                    createdAt: "asc",
                },
                include: LEAVE_APPROVAL_REQUEST_INCLUDE,
            }),
            prisma.leaveRequest.count({ where: pendingWhere }),
            prisma.leaveRequest.findMany({
                where: notTakenWhere,
                skip: (notTakenPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
                take: LEAVE_APPROVALS_PAGE_SIZE,
                orderBy: {
                    notTakenRequestedAt: "asc",
                },
                include: LEAVE_APPROVAL_REQUEST_INCLUDE,
            }),
            prisma.leaveRequest.count({ where: notTakenWhere }),
            prisma.leaveRequest.findMany({
                where: historyWhere,
                skip: (historyPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
                take: LEAVE_APPROVALS_PAGE_SIZE,
                orderBy: {
                    updatedAt: "desc",
                },
                include: LEAVE_APPROVAL_REQUEST_INCLUDE,
            }),
            prisma.leaveRequest.count({ where: historyWhere }),
            prisma.leaveRequest.findMany({
                where: cancellationWhere,
                skip: (cancellationPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
                take: LEAVE_APPROVALS_PAGE_SIZE,
                orderBy: { cancellationRequestedAt: "asc" },
                include: LEAVE_APPROVAL_REQUEST_INCLUDE,
            }),
            prisma.leaveRequest.count({ where: cancellationWhere }),
        ]);

        return NextResponse.json({
            pending: pendingApprovals.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            notTakenPending: notTakenPending.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            history: approvalHistory.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            cancellationPending: cancellationPending.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            metadata: {
                pending: createLeaveApprovalMetadata(pendingPage, pendingCount),
                notTakenPending: createLeaveApprovalMetadata(notTakenPage, notTakenCount),
                history: createLeaveApprovalMetadata(historyPage, historyCount),
                cancellationPending: createLeaveApprovalMetadata(cancellationPage, cancellationCount),
            },
        });
    } catch (error) {
        console.error("Error fetching leave approvals:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApprovals },
            { status: 500 },
        );
    }
}
