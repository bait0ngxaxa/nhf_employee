import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { logAuthEvent } from "@/lib/server/audit";
import {
    clearHybridAuthCookies,
} from "@/lib/auth/hybrid/session";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import {
    logoutAllRefreshSessions,
    resolveAuthenticatedUserId,
} from "@/modules/auth";

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

        await logAuthEvent("LOGOUT", userId, user.email, {
            metadata: { method: "hybrid_logout_all" },
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
