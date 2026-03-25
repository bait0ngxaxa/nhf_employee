import { getServerSession } from "next-auth";
import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-ssot";
import { withTrustedMutation } from "@/lib/auth-csrf";
import { logAuthEvent } from "@/lib/audit";
import { authOptions } from "@/lib/auth";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    clearHybridAuthCookies,
    parseUserId,
} from "@/lib/hybrid-auth-session";
import { verifyAccessToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

async function resolveUserId(request: NextRequest): Promise<number | null> {
    const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    if (accessToken) {
        try {
            const claims = await verifyAccessToken(accessToken);
            return parseUserId(claims.sub);
        } catch {
            // fall back to NextAuth session
        }
    }

    const session = await getServerSession(authOptions);
    return parseUserId(session?.user?.id);
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const userId = await resolveUserId(request);
        if (!userId) {
            const unauthorized = NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
            clearHybridAuthCookies(unauthorized);
            return unauthorized;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });

        if (!user) {
            const unauthorized = NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
            clearHybridAuthCookies(unauthorized);
            return unauthorized;
        }

        await prisma.authRefreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });

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
