import { after, NextResponse, type NextRequest } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    cancelLeaveRequest,
    confirmLeaveCancellation,
    LeaveCancellationError,
    rejectLeaveCancellation,
} from "@/lib/services/leave/cancellation";
import { processOutbox } from "@/lib/services/outbox/processor";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    leaveCancelSchema,
    leaveCancellationDecisionSchema,
} from "@/lib/validations/leave";
import { toLeaveRequestDays } from "@/lib/services/leave/half-days";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(req, "leave-cancel");
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const auth = await requireActiveWorkforceSession({
            employeeProfileNotFoundResponse: () =>
                jsonError(COMMON_API_MESSAGES.employeeProfileNotFound, 404),
        });
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "leave-cancel",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const body = await req.json();
        const parsed = leaveCancelSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const result = await cancelLeaveRequest(
            {
                userId: auth.user.id,
                employeeId: auth.employeeId,
                userEmail: auth.user.email,
            },
            parsed.data.leaveId,
            parsed.data.reason,
        );

        after(() => {
            processOutbox().catch((error: unknown) =>
                console.error("Failed to process leave cancellation outbox:", error),
            );
        });

        return NextResponse.json({
            success: true,
            data: toLeaveRequestDays(result.request),
        });
    } catch (error: unknown) {
        console.error("Cancel leave error:", error);
        if (error instanceof LeaveCancellationError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.internalServerError, 500);
    }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(req, "leave-cancel");
        if (preAuthRateLimitResponse) return preAuthRateLimitResponse;

        const auth = await requireActiveWorkforceSession();
        if (!auth.ok) return auth.response;

        const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "leave-cancel",
            auth.user.id,
        );
        if (principalRateLimitResponse) return principalRateLimitResponse;

        const body = await req.json();
        const parsed = leaveCancellationDecisionSchema.safeParse(body);
        if (!parsed.success) {
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const actor = {
            userId: auth.user.id,
            employeeId: auth.employeeId,
            role: auth.user.role,
            name: auth.user.name,
            userEmail: auth.user.email,
        };
        const result = parsed.data.action === "REJECT"
            ? await rejectLeaveCancellation(actor, parsed.data.leaveId, parsed.data.reason)
            : await confirmLeaveCancellation(actor, parsed.data.leaveId, parsed.data.reason);

        after(() => {
            processOutbox().catch((error: unknown) =>
                console.error("Failed to process leave cancellation confirmation outbox:", error),
            );
        });

        return NextResponse.json({
            success: true,
            data: toLeaveRequestDays(result.request),
        });
    } catch (error: unknown) {
        console.error("Leave cancellation decision error:", error);
        if (error instanceof LeaveCancellationError) {
            return jsonError(error.message, error.statusCode);
        }
        return jsonError(COMMON_API_MESSAGES.operationFailed, 500);
    }
}
