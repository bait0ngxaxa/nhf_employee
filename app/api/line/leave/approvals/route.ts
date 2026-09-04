import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    getApproverLeaveActions,
    getLeaveApprovalList,
    parseLeaveApprovalPage,
    toLiffLeaveApprovalItem,
} from "@/modules/leave";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound, serverError } from "@/lib/ssot/http";
import { API_ROUTES } from "@/lib/ssot/routes";

export async function GET(request: Request): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();

    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const pendingPage = parseLeaveApprovalPage(url, "pendingPage");
        const notTakenPage = parseLeaveApprovalPage(url, "notTakenPage");
        const cancellationPage = parseLeaveApprovalPage(url, "cancellationPage");
        if (!pendingPage || !notTakenPage || !cancellationPage) {
            return jsonError("หมายเลขหน้ารายการรอพิจารณาไม่ถูกต้อง", 400);
        }

        const approvals = await getLeaveApprovalList({
            managerId: auth.employeeId,
            pendingPage,
            notTakenPage,
            historyPage: 1,
            cancellationPage,
            historyFilters: {},
            includeHistory: false,
            buildAttachmentUrl: API_ROUTES.line.leaveAttachmentById,
        });
        const withActions = approvals.pending.map((item) =>
            toLiffLeaveApprovalItem(item, getApproverLeaveActions(item)),
        );
        const notTakenWithActions = approvals.notTakenPending.map((item) =>
            toLiffLeaveApprovalItem(item, getApproverLeaveActions(item)),
        );
        const cancellationWithActions = approvals.cancellationPending.map((item) =>
            toLiffLeaveApprovalItem(item, getApproverLeaveActions(item)),
        );
        const totalActionable = approvals.metadata.pending.totalItems
            + approvals.metadata.notTakenPending.totalItems
            + approvals.metadata.cancellationPending.totalItems;

        return NextResponse.json({
            pending: withActions,
            notTakenPending: notTakenWithActions,
            cancellationPending: cancellationWithActions,
            metadata: {
                pending: approvals.metadata.pending,
                notTakenPending: approvals.metadata.notTakenPending,
                cancellationPending: approvals.metadata.cancellationPending,
            },
            hasActionableWork: totalActionable > 0,
        });
    } catch (error) {
        console.error("Error fetching LIFF leave approvals", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
