import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";
import {
    createLeaveApprovalMetadata,
    getAdminLeaveRecoveryCandidateWhere,
    LEAVE_APPROVALS_PAGE_SIZE,
    LEAVE_APPROVAL_REQUEST_INCLUDE,
    parseLeaveApprovalPage,
} from "@/lib/services/leave/approval-queries";
import { withLeaveAttachmentSummaries } from "@/lib/services/leave/attachment-summary";

const RECOVERY_PAGINATION_MESSAGES = {
    invalidPage: "หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1",
} as const;

export async function GET(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;
        if (!isAdminRole(auth.user.role)) {
            return forbidden();
        }

        const url = new URL(req.url);
        const notTakenPage = parseLeaveApprovalPage(url, "notTakenPage");
        const cancellationPage = parseLeaveApprovalPage(url, "cancellationPage");
        if (!notTakenPage || !cancellationPage) {
            return NextResponse.json(
                { error: RECOVERY_PAGINATION_MESSAGES.invalidPage },
                { status: 400 },
            );
        }

        const recoveryCandidateWhere = getAdminLeaveRecoveryCandidateWhere(
            auth.employeeId,
        );
        const notTakenWhere: Prisma.LeaveRequestWhereInput = {
            ...recoveryCandidateWhere,
            status: "APPROVED",
            notTakenRequestedAt: { not: null },
            notTakenConfirmedAt: null,
        };
        const cancellationWhere: Prisma.LeaveRequestWhereInput = {
            ...recoveryCandidateWhere,
            status: "CANCELLATION_REQUESTED",
        };

        const [
            notTakenPending,
            notTakenCount,
            cancellationPending,
            cancellationCount,
        ] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: notTakenWhere,
                skip: (notTakenPage - 1) * LEAVE_APPROVALS_PAGE_SIZE,
                take: LEAVE_APPROVALS_PAGE_SIZE,
                orderBy: { notTakenRequestedAt: "asc" },
                include: LEAVE_APPROVAL_REQUEST_INCLUDE,
            }),
            prisma.leaveRequest.count({ where: notTakenWhere }),
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
            notTakenPending: notTakenPending.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            cancellationPending: cancellationPending.map((request) =>
                toLeaveRequestDays(withLeaveAttachmentSummaries(request)),
            ),
            metadata: {
                notTakenPending: createLeaveApprovalMetadata(notTakenPage, notTakenCount),
                cancellationPending: createLeaveApprovalMetadata(
                    cancellationPage,
                    cancellationCount,
                ),
            },
        });
    } catch (error) {
        console.error("Error fetching leave admin recovery candidates:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApprovals },
            { status: 500 },
        );
    }
}
