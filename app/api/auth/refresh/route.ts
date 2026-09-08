import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
    getClientMetadata,
    setHybridAuthCookies,
} from "@/lib/auth/hybrid/session";
import { enforcePreAuthIpRateLimit } from "@/lib/security/mutation-rate-limit";
import { appendAuditBestEffort } from "@/modules/audit";
import { refreshHybridSession } from "@/modules/auth";

function unauthorizedResponse(): NextResponse {
    const response = NextResponse.json(
        { error: AUTH_ERROR_MESSAGES.unauthorized },
        { status: 401 },
    );
    clearHybridAuthCookies(response);
    return response;
}

async function logRefreshSecurityEvent(input: {
    userId: number;
    email: string;
    familyId: string;
    reason: "refresh_token_reuse_or_expired" | "inactive_user_refresh_attempt";
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await appendAuditBestEffort({
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: input.userId,
        userId: input.userId,
        userEmail: input.email,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        details: {
            metadata: {
                authFlow: "hybrid_refresh",
                reason: input.reason,
                familyId: input.familyId,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            },
        },
    });
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const rateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "auth-refresh",
        );
        if (rateLimitResponse) return rateLimitResponse;

        const metadata = getClientMetadata(request);
        const result = await refreshHybridSession({
            rawRefreshToken: request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value,
            metadata,
        });

        if (result.status === "unauthorized") {
            if (result.securityEvent) {
                await logRefreshSecurityEvent(result.securityEvent);
            }
            return unauthorizedResponse();
        }

        const response = NextResponse.json({ success: true });
        setHybridAuthCookies(response, result.accessToken, result.rawRefreshToken);
        return response;
    } catch {
        return NextResponse.json(
            { error: AUTH_ERROR_MESSAGES.internalServerError },
            { status: 500 },
        );
    }
});
