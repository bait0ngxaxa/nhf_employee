import { NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { getLeaveApprovalList } from "@/lib/services/leave/approval-list";
import { parseLeaveApprovalPage } from "@/lib/services/leave/approval-queries";
import { parseApproverLeaveHistoryFilters } from "@/lib/services/leave/history-filters";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

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

        const url = new URL(req.url);
        const pendingPage = parseLeaveApprovalPage(url, "pendingPage");
        const notTakenPage = parseLeaveApprovalPage(url, "notTakenPage");
        const historyPage = parseLeaveApprovalPage(url, "historyPage");
        const cancellationPage = parseLeaveApprovalPage(url, "cancellationPage");
        if (!pendingPage || !notTakenPage || !historyPage || !cancellationPage) {
            return jsonError(APPROVALS_PAGINATION_MESSAGES.invalidPage, 400);
        }

        const filtersResult = parseApproverLeaveHistoryFilters(url);
        if (!filtersResult.success) {
            return jsonError(filtersResult.error, 400);
        }

        return NextResponse.json(await getLeaveApprovalList({
            managerId: auth.employeeId,
            pendingPage,
            notTakenPage,
            historyPage,
            cancellationPage,
            historyFilters: filtersResult.filters,
        }));
    } catch (error) {
        console.error("Error fetching leave approvals:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchApprovals, 500);
    }
}
