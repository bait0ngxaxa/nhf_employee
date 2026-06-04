import { type NextRequest } from "next/server";

import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
    parseUserId,
} from "@/lib/hybrid-auth-session";
import { hashRefreshToken, verifyAccessToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

export async function resolveAuthenticatedUserId(request: NextRequest): Promise<number | null> {
    const accessToken = request.cookies.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    if (!accessToken) {
        return null;
    }

    try {
        const claims = await verifyAccessToken(accessToken);
        return parseUserId(claims.sub);
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
