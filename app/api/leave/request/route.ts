import { type NextRequest, type NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    createLeaveRequestErrorResponse,
    handleLeaveRequestSubmission,
} from "@/lib/server/leave-request-api";
import { assertLeaveRequestBodySize } from "@/lib/services/leave/request-input";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound } from "@/lib/ssot/http";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        return notFound();
    }

    const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
        request,
        "leave-request-create",
    );
    if (preAuthRateLimitResponse) {
        return preAuthRateLimitResponse;
    }

    try {
        assertLeaveRequestBodySize(request);
    } catch (error) {
        return createLeaveRequestErrorResponse(error);
    }

    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) {
        return auth.response;
    }
    const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
        "leave-request-create",
        auth.user.id,
    );
    if (principalRateLimitResponse) {
        return principalRateLimitResponse;
    }

    return handleLeaveRequestSubmission(request, {
        userId: auth.user.id,
        employeeId: auth.employeeId,
        userEmail: auth.user.email,
    });
}
