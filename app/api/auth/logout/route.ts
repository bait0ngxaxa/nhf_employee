import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
    getClientMetadata,
} from "@/lib/auth/hybrid/session";
import { appendAuditBestEffort } from "@/modules/audit";
import { logoutCurrentRefreshSession } from "@/modules/auth";

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
        if (refreshToken) {
            const revoked = await logoutCurrentRefreshSession(refreshToken);
            if (revoked) {
                const metadata = getClientMetadata(request);
                await appendAuditBestEffort({
                    action: "LOGOUT",
                    entityType: "User",
                    entityId: revoked.userId,
                    userId: revoked.userId,
                    userEmail: revoked.email,
                    ipAddress: metadata.ipAddress,
                    userAgent: metadata.userAgent,
                    details: { metadata: { method: "hybrid_logout" } },
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
