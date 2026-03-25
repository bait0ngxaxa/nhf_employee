import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-ssot";
import { withTrustedMutation } from "@/lib/auth-csrf";
import { logAuthEvent } from "@/lib/audit";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
} from "@/lib/hybrid-auth-session";
import { hashRefreshToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

async function revokeCurrentRefreshToken(tokenHash: string): Promise<{ userId: number; email: string } | null> {
    const tokenRecord = await prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        include: {
            user: {
                select: { id: true, email: true },
            },
        },
    });

    if (!tokenRecord || tokenRecord.revokedAt) {
        return null;
    }

    await prisma.authRefreshToken.update({
        where: { id: tokenRecord.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    return { userId: tokenRecord.user.id, email: tokenRecord.user.email };
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
        if (refreshToken) {
            const revoked = await revokeCurrentRefreshToken(hashRefreshToken(refreshToken));
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
