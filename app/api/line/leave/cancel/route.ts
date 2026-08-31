import { after, NextResponse, type NextRequest } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { enforceLeaveJsonBodySize } from "@/lib/server/leave-api";
import {
    cancelLeaveRequest,
    confirmLeaveCancellation,
    LeaveCancellationError,
    rejectLeaveCancellation,
} from "@/lib/services/leave/cancellation";
import { toLiffLeaveMutationResponse } from "@/lib/services/leave/liff-serialization";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { jsonError, notFound } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    leaveCancellationDecisionSchema,
    leaveCancelSchema,
} from "@/lib/validations/leave";

async function requireLeaveMutation(
    req: NextRequest,
): Promise<
    | { ok: true; auth: Awaited<ReturnType<typeof requireLiffWorkforceSession>> & { ok: true } }
    | { ok: false; response: NextResponse }
> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        return { ok: false, response: notFound() };
    }
    const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(req, "leave-cancel");
    if (preAuthRateLimitResponse) {
        return { ok: false, response: preAuthRateLimitResponse };
    }
    const bodySizeResponse = enforceLeaveJsonBodySize(req);
    if (bodySizeResponse) return { ok: false, response: bodySizeResponse };

    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return { ok: false, response: auth.response };
    const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
        "leave-cancel",
        auth.user.id,
    );
    if (principalRateLimitResponse) {
        return { ok: false, response: principalRateLimitResponse };
    }
    return { ok: true, auth };
}

function scheduleOutbox(): void {
    after(() => {
        processOutbox().catch((error: unknown) =>
            console.error("Process LIFF leave cancellation outbox failed", {
                errorType: error instanceof Error ? error.name : "UnknownError",
            }),
        );
    });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const authorization = await requireLeaveMutation(req);
        if (!authorization.ok) return authorization.response;
        const parsed = leaveCancelSchema.safeParse(await req.json());
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const result = await cancelLeaveRequest(
            {
                userId: authorization.auth.user.id,
                employeeId: authorization.auth.employeeId,
                userEmail: authorization.auth.user.email,
            },
            parsed.data.leaveId,
            parsed.data.reason,
        );
        scheduleOutbox();
        return NextResponse.json({
            success: true,
            data: toLiffLeaveMutationResponse(result.request),
        });
    } catch (error) {
        if (error instanceof LeaveCancellationError) {
            return jsonError(error.message, error.statusCode);
        }
        console.error("LIFF leave cancellation failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return jsonError(COMMON_API_MESSAGES.internalServerError, 500);
    }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
    try {
        const authorization = await requireLeaveMutation(req);
        if (!authorization.ok) return authorization.response;
        const parsed = leaveCancellationDecisionSchema.safeParse(await req.json());
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }
        const actor = {
            userId: authorization.auth.user.id,
            employeeId: authorization.auth.employeeId,
            role: authorization.auth.user.role,
            name: authorization.auth.user.name,
            userEmail: authorization.auth.user.email,
            allowAdminOverride: false,
        };
        const result = parsed.data.action === "REJECT"
            ? await rejectLeaveCancellation(actor, parsed.data.leaveId, parsed.data.reason)
            : await confirmLeaveCancellation(actor, parsed.data.leaveId, parsed.data.reason);
        scheduleOutbox();
        return NextResponse.json({
            success: true,
            data: toLiffLeaveMutationResponse(result.request),
        });
    } catch (error) {
        if (error instanceof LeaveCancellationError) {
            return jsonError(error.message, error.statusCode);
        }
        console.error("LIFF leave cancellation decision failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}
