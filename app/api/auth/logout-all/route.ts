import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import {
    clearHybridAuthCookies,
    getClientMetadata,
} from "@/lib/auth/hybrid/session";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import {
    logoutAllRefreshSessions,
    resolveAuthenticatedUserId,
} from "@/modules/auth";
import { appendAuditBestEffort } from "@/modules/audit";

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const userId = await resolveAuthenticatedUserId(
            request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value,
        );
        if (!userId) {
            const unauthorized = NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
            clearHybridAuthCookies(unauthorized);
            return unauthorized;
        }

        const user = await logoutAllRefreshSessions(userId);
        if (!user) {
            const unauthorized = NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
            clearHybridAuthCookies(unauthorized);
            return unauthorized;
        }

        const metadata = getClientMetadata(request);
        await appendAuditBestEffort({
            action: "LOGOUT",
            entityType: "User",
            entityId: userId,
            userId,
            userEmail: user.email,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            details: { metadata: { method: "hybrid_logout_all" } },
        });

        const response = NextResponse.json({ success: true });
        clearHybridAuthCookies(response);
        return response;
    } catch {
        const response = NextResponse.json(
            { error: AUTH_ERROR_MESSAGES.internalServerError },
            { status: 500 },
        );
        clearHybridAuthCookies(response);
        return response;
    }
});
