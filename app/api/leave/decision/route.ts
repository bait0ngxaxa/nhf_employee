import { after, NextResponse, type NextRequest } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    enforceLeaveJsonBodySize,
    readLeaveJsonBody,
    decideLeaveRequest,
    LeaveApprovalError,
    leaveActionSchema,
    toLeaveRequestDays,
} from "@/modules/leave";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }
        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
            req,
            "leave-decision",
        );
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;
        const bodySizeResponse = enforceLeaveJsonBodySize(req);
        if (bodySizeResponse) return bodySizeResponse;

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;
        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "leave-decision",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const body = await readLeaveJsonBody(req);
        if (!body.ok) return body.response;
        const parsed = leaveActionSchema.safeParse(body.body);
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
                console.error("Failed to process leave outbox in background:", {
                    errorType: error instanceof Error ? error.name : "UnknownError",
                }),
            );
        });
        return NextResponse.json({
            success: true,
            data: toLeaveRequestDays(result),
        });
    } catch (error) {
        console.error("Intranet Leave Approval Error:", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        if (error instanceof LeaveApprovalError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.failedToProcessLeaveApproval, 500);
    }
}
