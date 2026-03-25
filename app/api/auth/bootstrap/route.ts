import { getServerSession } from "next-auth";
import { type NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES, authSessionUserSelect } from "@/lib/auth-ssot";
import { authOptions } from "@/lib/auth";
import { withTrustedMutation } from "@/lib/auth-csrf";
import {
    HYBRID_REFRESH_COOKIE_NAME,
    getClientMetadata,
    parseUserId,
    setHybridAuthCookies,
} from "@/lib/hybrid-auth-session";
import {
    buildRefreshTokenRecord,
    hashRefreshToken,
    issueAccessToken,
} from "@/lib/hybrid-auth-tokens";
import { prisma } from "@/lib/prisma";

async function issueNewTokenPair(
    request: NextRequest,
    userId: number,
    role: string,
    tokenVersion: number,
): Promise<{ accessToken: string; refreshToken: string }> {
    const metadata = getClientMetadata(request);
    const refreshDraft = buildRefreshTokenRecord({
        userId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
    });

    const accessToken = await issueAccessToken({
        userId,
        role,
        sessionId: refreshDraft.record.familyId,
        tokenVersion,
    });

    await prisma.authRefreshToken.create({
        data: {
            userId: refreshDraft.record.userId,
            tokenHash: refreshDraft.record.tokenHash,
            familyId: refreshDraft.record.familyId,
            expiresAt: refreshDraft.record.expiresAt,
            userAgent: refreshDraft.record.userAgent,
            ipAddress: refreshDraft.record.ipAddress,
        },
    });

    return { accessToken, refreshToken: refreshDraft.rawToken };
}

async function resumeExistingRefreshToken(
    refreshToken: string,
    userId: number,
    role: string,
    tokenVersion: number,
): Promise<{ accessToken: string; refreshToken: string } | null> {
    const tokenHash = hashRefreshToken(refreshToken);
    const existing = await prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        select: {
            userId: true,
            familyId: true,
            revokedAt: true,
            expiresAt: true,
        },
    });

    if (!existing || existing.userId !== userId || existing.revokedAt) {
        return null;
    }

    if (existing.expiresAt <= new Date()) {
        return null;
    }

    const accessToken = await issueAccessToken({
        userId,
        role,
        sessionId: existing.familyId,
        tokenVersion,
    });

    return { accessToken, refreshToken };
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const session = await getServerSession(authOptions);
        const userId = parseUserId(session?.user?.id);

        if (!userId || !session?.user?.role) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: authSessionUserSelect,
        });

        if (!user || !user.isActive) {
            return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
        }

        const existingRefresh = request.cookies.get(HYBRID_REFRESH_COOKIE_NAME)?.value;
        const tokenPair = existingRefresh
            ? await resumeExistingRefreshToken(existingRefresh, user.id, user.role, (user.tokenVersion ?? 1))
            : null;
        const finalTokenPair = tokenPair ??
            (await issueNewTokenPair(request, user.id, user.role, (user.tokenVersion ?? 1)));

        const response = NextResponse.json({ success: true });
        setHybridAuthCookies(response, finalTokenPair.accessToken, finalTokenPair.refreshToken);
        return response;
    } catch (error) {
        console.error("[HybridAuth][bootstrap] failed:", error);
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.internalServerError }, { status: 500 });
    }
});
