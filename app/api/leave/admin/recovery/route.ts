import { NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    getAdminLeaveRecoveryData,
    parseLeaveApprovalPage,
} from "@/modules/leave";
import { notFound, forbidden } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";

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

        return NextResponse.json(await getAdminLeaveRecoveryData({
            employeeId: auth.employeeId,
            notTakenPage,
            cancellationPage,
        }));
    } catch (error) {
        console.error("Error fetching leave admin recovery candidates:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApprovals },
            { status: 500 },
        );
    }
}
