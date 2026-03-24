import { type NextRequest, NextResponse } from "next/server";

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
    setHybridAuthCookies,
} from "@/lib/hybrid-auth-session";
import { prisma } from "@/lib/prisma";

function unauthorizedResponse(): NextResponse {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

export async function POST(request: NextRequest): Promise<NextResponse> {
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
                    select: { id: true, email: true, role: true, isActive: true },
                },
            },
        });

        if (!existingToken) {
            return unauthorizedResponse();
        }

        const now = new Date();
        if (existingToken.revokedAt || existingToken.expiresAt <= now) {
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
            tokenVersion: 1,
        });

        await prisma.$transaction([
            prisma.authRefreshToken.update({
                where: { id: existingToken.id },
                data: { revokedAt: now, lastUsedAt: now },
            }),
            prisma.authRefreshToken.create({
                data: {
                    userId: nextToken.record.userId,
                    tokenHash: nextToken.record.tokenHash,
                    familyId: nextToken.record.familyId,
                    rotatedFromId: existingToken.id,
                    expiresAt: nextToken.record.expiresAt,
                    userAgent: nextToken.record.userAgent,
                    ipAddress: nextToken.record.ipAddress,
                },
            }),
        ]);

        const response = NextResponse.json({ success: true });
        setHybridAuthCookies(response, accessToken, nextToken.rawToken);
        return response;
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
