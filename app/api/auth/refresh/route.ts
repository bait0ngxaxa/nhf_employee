import type { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES, authRefreshUserSelect } from "@/lib/auth/ssot";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { logAuthEvent } from "@/lib/server/audit";
import {
    buildRefreshTokenRecord,
    hashRefreshToken,
    issueAccessToken,
} from "@/lib/auth/hybrid/tokens";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    clearHybridAuthCookies,
    getClientMetadata,
    setHybridAuthCookies,
} from "@/lib/auth/hybrid/session";
import { prisma } from "@/lib/db/prisma";
import { enforcePreAuthIpRateLimit } from "@/lib/security/mutation-rate-limit";

type RefreshTokenStore = Pick<Prisma.TransactionClient, "authRefreshToken">;

type RefreshRotationResult =
    | { status: "rotated"; rawToken: string }
    | { status: "alreadyRotated" }
    | { status: "invalid" };

interface RefreshRotationInput {
    tokenId: string;
    userId: number;
    familyId: string;
    now: Date;
    userAgent?: string;
    ipAddress?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasRotatedFromUniqueTarget(target: unknown): boolean {
    if (Array.isArray(target)) {
        return target.includes("rotatedFromId");
    }
    return typeof target === "string" && target.includes("rotatedFromId");
}

function isRotatedFromUniqueConflict(error: unknown): boolean {
    if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) {
        return false;
    }
    return hasRotatedFromUniqueTarget(error.meta.target);
}

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

async function hasSuccessorToken(
    rotatedFromId: string,
    client: RefreshTokenStore = prisma,
): Promise<boolean> {
    const successor = await client.authRefreshToken.findFirst({
        where: {
            rotatedFromId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: { id: true },
    });

    return Boolean(successor);
}

async function rotateRefreshTokenAtomically(
    input: RefreshRotationInput,
): Promise<RefreshRotationResult> {
    const nextToken = buildRefreshTokenRecord({
        userId: input.userId,
        familyId: input.familyId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
    });

    const result = await prisma.$transaction(async (tx) => {
        const claimedToken = await tx.authRefreshToken.updateMany({
            where: { id: input.tokenId, revokedAt: null },
            data: { revokedAt: input.now, lastUsedAt: input.now },
        });

        if (claimedToken.count === 0) {
            const hasSuccessor = await hasSuccessorToken(input.tokenId, tx);
            return hasSuccessor
                ? { status: "alreadyRotated" as const }
                : { status: "invalid" as const };
        }

        try {
            await tx.authRefreshToken.create({
                data: {
                    userId: nextToken.record.userId,
                    tokenHash: nextToken.record.tokenHash,
                    familyId: nextToken.record.familyId,
                    rotatedFromId: input.tokenId,
                    expiresAt: nextToken.record.expiresAt,
                    userAgent: nextToken.record.userAgent,
                    ipAddress: nextToken.record.ipAddress,
                },
            });
        } catch (error) {
            if (isRotatedFromUniqueConflict(error)) {
                return { status: "alreadyRotated" as const };
            }
            throw error;
        }

        return { status: "rotated" as const };
    });

    if (result.status !== "rotated") {
        return result;
    }
    return { status: "rotated", rawToken: nextToken.rawToken };
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const rateLimitResponse = enforcePreAuthIpRateLimit(
            request,
            "auth-refresh",
        );
        if (rateLimitResponse) return rateLimitResponse;

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

        const rotation = await rotateRefreshTokenAtomically({
            tokenId: existingToken.id,
            userId: existingToken.userId,
            familyId: existingToken.familyId,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
            now,
        });

        if (rotation.status === "alreadyRotated") {
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
        if (rotation.status === "invalid") {
            return unauthorizedResponse();
        }

        const accessToken = await issueAccessToken({
            userId: existingToken.userId,
            role: existingToken.user.role,
            sessionId: existingToken.familyId,
            tokenVersion: existingToken.user.tokenVersion ?? 1,
        });

        const response = NextResponse.json({ success: true });
        setHybridAuthCookies(response, accessToken, rotation.rawToken);
        return response;
    } catch {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
});
