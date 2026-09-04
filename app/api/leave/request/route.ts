import { after, type NextRequest, type NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    createLeaveRequestErrorResponse,
    handleLeaveRequestSubmission,
    assertLeaveRequestBodySize,
} from "@/modules/leave";
import { processOutbox } from "@/lib/services/outbox/processor";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound } from "@/lib/ssot/http";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";

function scheduleLeaveOutbox(): void {
    after(() => {
        processOutbox().catch((error: unknown) =>
            console.error("ประมวลผล outbox หลังสร้างคำขอลาไม่สำเร็จ", {
                errorType: error instanceof Error ? error.name : "UnknownError",
            }),
        );
    });
}

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

    return handleLeaveRequestSubmission(
        request,
        {
            userId: auth.user.id,
            employeeId: auth.employeeId,
            userEmail: auth.user.email,
        },
        undefined,
        undefined,
        scheduleLeaveOutbox,
    );
}
