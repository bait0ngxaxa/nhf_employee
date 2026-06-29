import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { logAuthEvent } from "@/lib/server/audit";
import {
    clearHybridAuthCookies,
} from "@/lib/auth/hybrid/session";
import { resolveAuthenticatedUserId } from "@/lib/auth/hybrid/route";
import { prisma } from "@/lib/db/prisma";

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const userId = await resolveAuthenticatedUserId(request);
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
