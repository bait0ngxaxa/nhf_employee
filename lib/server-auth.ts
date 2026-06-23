import { cookies } from "next/headers";

import type { HybridAuthSession } from "@/lib/auth-user";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/hybrid-auth-constants";
import { parseUserId } from "@/lib/hybrid-auth-session";
import { hasActiveSessionFamily } from "@/lib/hybrid-auth-session-store";
import { hashRefreshToken, verifyAccessToken } from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

export type ApiAuthSession = HybridAuthSession;

type SessionUser = NonNullable<Awaited<ReturnType<typeof findActiveUser>>>;

async function findActiveUser(userId: number) {
    return prisma.user.findUnique({
        where: { id: userId, isActive: true },
        include: {
            employee: {
                include: {
                    dept: { select: { name: true } },
                    subordinates: { select: { id: true }, take: 1 },
                },
            },
        },
    });
}

function toApiAuthSession(user: SessionUser): ApiAuthSession {
    return {
        user: {
            id: String(user.id),
            role: user.role,
            email: user.email,
            name: user.name,
            department: user.employee?.dept?.name,
            isManager: (user.employee?.subordinates?.length ?? 0) > 0,
        },
    };
}

async function getSessionFromRefreshToken(refreshToken: string | undefined): Promise<ApiAuthSession | null> {
    if (!refreshToken) {
        return null;
    }

    const record = await prisma.authRefreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(refreshToken) },
        select: {
            expiresAt: true,
            revokedAt: true,
            userId: true,
        },
    });

    if (!record || record.revokedAt || record.expiresAt <= new Date()) {
        return null;
    }

    const user = await findActiveUser(record.userId);
    return user ? toApiAuthSession(user) : null;
}

export async function getApiAuthSession(): Promise<ApiAuthSession | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(HYBRID_ACCESS_COOKIE_NAME)?.value;
    const refreshToken = cookieStore.get(HYBRID_REFRESH_COOKIE_NAME)?.value;

    if (!accessToken) {
        return getSessionFromRefreshToken(refreshToken);
    }

    try {
        const claims = await verifyAccessToken(accessToken);
        const userId = parseUserId(claims.sub);
        if (!userId) {
            return null;
        }

        const [user, hasActiveSession] = await Promise.all([
            findActiveUser(userId),
            hasActiveSessionFamily(userId, claims.sessionId),
        ]);

        if (!user || !hasActiveSession || claims.tokenVersion !== user.tokenVersion) {
            return null;
        }

        return toApiAuthSession(user);
    } catch {
        return getSessionFromRefreshToken(refreshToken);
    }
}
