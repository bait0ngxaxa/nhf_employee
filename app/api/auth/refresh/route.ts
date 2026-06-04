import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES, authRefreshUserSelect } from "@/lib/auth-ssot";
import { withTrustedMutation } from "@/lib/auth-csrf";
import { logAuthEvent } from "@/lib/audit";
import {
    buildRefreshTokenRecord,
    hashRefreshToken,
    issueAccessToken,
} from "@/lib/hybrid-auth-tokens";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
    getClientMetadata,
    setHybridAccessCookie,
    setHybridAuthCookies,
} from "@/lib/hybrid-auth-session";
import { prisma } from "@/lib/prisma";

const REFRESH_ROTATION_GRACE_MS = 10_000;

function unauthorizedResponse(): NextResponse {
    const response = NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
    clearHybridAuthCookies(response);
    return response;
}

async function revokeFamily(familyId: string): Promise<void> {
    await prisma.authRefreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

async function logRefreshSecurityEvent(input: {
    userId: number;
    email: string;
    familyId: string;
    reason: "refresh_token_reuse_or_expired" | "inactive_user_refresh_attempt";
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAuthEvent("LOGIN_FAILED", input.userId, input.email, {
        metadata: {
            authFlow: "hybrid_refresh",
            reason: input.reason,
            familyId: input.familyId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        },
    });
}

function isWithinRotationGrace(input: {
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    now: Date;
}): boolean {
    if (!input.lastUsedAt || !input.revokedAt) {
        return false;
    }

    const elapsedMs = input.now.getTime() - input.lastUsedAt.getTime();
    return elapsedMs >= 0 && elapsedMs <= REFRESH_ROTATION_GRACE_MS;
}

async function hasSuccessorToken(rotatedFromId: string): Promise<boolean> {
    const successor = await prisma.authRefreshToken.findFirst({
        where: {
            rotatedFromId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: { id: true },
    });

    return Boolean(successor);
}

async function buildAccessOnlyRefreshResponse(input: {
    userId: number;
    role: string;
    familyId: string;
    tokenVersion: number;
}): Promise<NextResponse> {
    const accessToken = await issueAccessToken({
        userId: input.userId,
        role: input.role,
        sessionId: input.familyId,
        tokenVersion: input.tokenVersion,
    });
    const response = NextResponse.json({ success: true });
    setHybridAccessCookie(response, accessToken);
    return response;
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const metadata = getClientMetadata(request);
        const refreshToken = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
        if (!refreshToken) {
            return unauthorizedResponse();
        }

        const tokenHash = hashRefreshToken(refreshToken);
        const existingToken = await prisma.authRefreshToken.findUnique({
            where: { tokenHash },
            include: {
                user: {
                    select: authRefreshUserSelect,
                },
            },
        });

        if (!existingToken) {
            return unauthorizedResponse();
        }

        const now = new Date();
        if (existingToken.revokedAt) {
            const isRecentRotation = isWithinRotationGrace({
                lastUsedAt: existingToken.lastUsedAt,
                revokedAt: existingToken.revokedAt,
                now,
            });

            if (
                isRecentRotation &&
                existingToken.user.isActive &&
                await hasSuccessorToken(existingToken.id)
            ) {
                return buildAccessOnlyRefreshResponse({
                    userId: existingToken.userId,
                    role: existingToken.user.role,
                    familyId: existingToken.familyId,
                    tokenVersion: existingToken.user.tokenVersion ?? 1,
                });
            }

            await revokeFamily(existingToken.familyId);
            await logRefreshSecurityEvent({
                userId: existingToken.userId,
                email: existingToken.user.email,
                familyId: existingToken.familyId,
                reason: "refresh_token_reuse_or_expired",
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
            });
            return unauthorizedResponse();
        }

        if (existingToken.expiresAt <= now) {
            await revokeFamily(existingToken.familyId);
            await logRefreshSecurityEvent({
                userId: existingToken.userId,
                email: existingToken.user.email,
                familyId: existingToken.familyId,
                reason: "refresh_token_reuse_or_expired",
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
            });
            return unauthorizedResponse();
        }

        if (!existingToken.user.isActive) {
            await revokeFamily(existingToken.familyId);
            await logRefreshSecurityEvent({
                userId: existingToken.userId,
                email: existingToken.user.email,
                familyId: existingToken.familyId,
                reason: "inactive_user_refresh_attempt",
                ipAddress: metadata.ipAddress,
                userAgent: metadata.userAgent,
            });
            return unauthorizedResponse();
        }

        const nextToken = buildRefreshTokenRecord({
            userId: existingToken.userId,
            familyId: existingToken.familyId,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
        });

        const accessToken = await issueAccessToken({
            userId: existingToken.userId,
            role: existingToken.user.role,
            sessionId: existingToken.familyId,
            tokenVersion: existingToken.user.tokenVersion ?? 1,
        });

        const claimedToken = await prisma.authRefreshToken.updateMany({
            where: { id: existingToken.id, revokedAt: null },
            data: { revokedAt: now, lastUsedAt: now },
        });

        if (claimedToken.count === 0) {
            if (await hasSuccessorToken(existingToken.id)) {
                return buildAccessOnlyRefreshResponse({
                    userId: existingToken.userId,
                    role: existingToken.user.role,
                    familyId: existingToken.familyId,
                    tokenVersion: existingToken.user.tokenVersion ?? 1,
                });
            }

            return unauthorizedResponse();
        }

        await prisma.authRefreshToken.create({
            data: {
                userId: nextToken.record.userId,
                tokenHash: nextToken.record.tokenHash,
                familyId: nextToken.record.familyId,
                rotatedFromId: existingToken.id,
                expiresAt: nextToken.record.expiresAt,
                userAgent: nextToken.record.userAgent,
                ipAddress: nextToken.record.ipAddress,
            },
        });

        const response = NextResponse.json({ success: true });
        setHybridAuthCookies(response, accessToken, nextToken.rawToken);
        return response;
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
});
