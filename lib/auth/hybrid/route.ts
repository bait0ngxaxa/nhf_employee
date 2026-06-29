import { type NextRequest } from "next/server";

import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
    parseUserId,
} from "@/lib/auth/hybrid/session";
import { hasActiveSessionFamily } from "@/lib/auth/hybrid/session-store";
import { hashRefreshToken, verifyAccessToken } from "@/lib/auth/hybrid/tokens";
import { prisma } from "@/lib/db/prisma";

export async function resolveAuthenticatedUserId(request: NextRequest): Promise<number | null> {
    const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    if (!accessToken) {
        return null;
    }

    try {
        const claims = await verifyAccessToken(accessToken);
        const userId = parseUserId(claims.sub);
        if (!userId) {
            return null;
        }

        return (await hasActiveSessionFamily(userId, claims.sessionId))
            ? userId
            : null;
    } catch {
        return null;
    }
}

export async function resolveCurrentSessionFamilyId(
    request: NextRequest,
    userId: number,
): Promise<string | null> {
    const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    if (accessToken) {
        try {
            const claims = await verifyAccessToken(accessToken);
            if (parseUserId(claims.sub) === userId) {
                return claims.sessionId;
            }
        } catch {
            // Fall through to refresh-token lookup.
        }
    }

    const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
    if (!refreshToken) {
        return null;
    }

    const record = await prisma.authRefreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
        select: { userId: true, familyId: true },
    });

    if (!record || record.userId !== userId) {
        return null;
    }

    return record.familyId;
}
