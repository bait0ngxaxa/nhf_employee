import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { logAuthEvent } from "@/lib/server/audit";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
} from "@/lib/auth/hybrid/session";
import { logoutCurrentRefreshSession } from "@/modules/auth";

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
        if (refreshToken) {
            const revoked = await logoutCurrentRefreshSession(refreshToken);
            if (revoked) {
                await logAuthEvent("LOGOUT", revoked.userId, revoked.email, {
                    metadata: { method: "hybrid_logout" },
                });
            }
        }

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
