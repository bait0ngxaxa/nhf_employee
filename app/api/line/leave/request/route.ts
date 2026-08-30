import type { NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    createLeaveRequestErrorResponse,
    handleLeaveRequestSubmission,
} from "@/lib/server/leave-request-api";
import { assertLeaveRequestBodySize } from "@/lib/services/leave/request-input";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { API_ROUTES } from "@/lib/ssot/routes";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound } from "@/lib/ssot/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();

    const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
        request,
        "leave-request-create",
    );
    if (preAuthRateLimitResponse) return preAuthRateLimitResponse;
    try {
        assertLeaveRequestBodySize(request);
    } catch (error) {
        return createLeaveRequestErrorResponse(error);
    }

    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;
    const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
        "leave-request-create",
        auth.user.id,
    );
    if (principalRateLimitResponse) return principalRateLimitResponse;

    return handleLeaveRequestSubmission(
        request,
        {
            userId: auth.user.id,
            employeeId: auth.employeeId,
            userEmail: auth.user.email,
        },
        API_ROUTES.line.leaveAttachmentById,
    );
}
