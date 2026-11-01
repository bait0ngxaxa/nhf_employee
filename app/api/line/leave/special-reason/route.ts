import { type NextRequest, type NextResponse } from "next/server";
import { requireLiffWorkforceSession } from "@/modules/line";
import { assertTrustedMutationRequest } from "@/lib/auth/csrf";
import { enforcePreAuthIpRateLimit, enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound } from "@/lib/ssot/http";
import { buildLeaveAuthorizationContext, enforceLeaveJsonBodySize, handleLeaveSpecialReasonAmendment } from "@/modules/leave";

export async function PUT(request: NextRequest): Promise<NextResponse> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) return notFound();
    const preAuth = enforcePreAuthIpRateLimit(request, "leave-special-reason");
    if (preAuth) return preAuth;
    const csrf = assertTrustedMutationRequest(request);
    if (csrf) return csrf;
    const size = enforceLeaveJsonBodySize(request);
    if (size) return size;
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;
    const rateLimit = enforceAuthenticatedMutationRateLimit("leave-special-reason", auth.user.id);
    if (rateLimit) return rateLimit;
    return handleLeaveSpecialReasonAmendment(request, {
        userEmail: auth.user.email,
        authorization: buildLeaveAuthorizationContext(auth.user, auth.employeeId, "LIFF_SELF_SERVICE"),
    });
}
