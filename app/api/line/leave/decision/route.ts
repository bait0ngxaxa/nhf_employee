import { after, NextResponse, type NextRequest } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { enforceLeaveJsonBodySize } from "@/lib/server/leave-api";
import {
    decideLeaveRequest,
    LeaveApprovalError,
} from "@/lib/services/leave/decision";
import { toLiffLeaveMutationResponse } from "@/lib/services/leave/liff-serialization";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { leaveActionSchema } from "@/lib/validations/leave";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            req,
            "leave-decision",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;
        const bodySizeResponse = enforceLeaveJsonBodySize(req);
        if (bodySizeResponse) return bodySizeResponse;

        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;
        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "leave-decision",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const parsed = leaveActionSchema.safeParse(await req.json());
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidActionParameters, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const result = await decideLeaveRequest(
            {
                userId: auth.user.id,
                employeeId: auth.employeeId,
                userEmail: auth.user.email,
                name: auth.user.name,
            },
            parsed.data,
        );
        after(() => {
            processOutbox().catch((error: unknown) =>
                console.error("Process LIFF leave decision outbox failed", {
                    errorType: error instanceof Error ? error.name : "UnknownError",
                }),
            );
        });
        return NextResponse.json({
            success: true,
            data: toLiffLeaveMutationResponse(result),
        });
    } catch (error) {
        if (error instanceof LeaveApprovalError) {
            return jsonError(error.message, error.statusCode);
        }
        console.error("LIFF leave decision failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return jsonError(COMMON_API_MESSAGES.failedToProcessLeaveApproval, 500);
    }
}
