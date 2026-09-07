import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const AUTH_REFRESH_USER_SELECT = {
    id: true,
    email: true,
    role: true,
    isActive: true,
    tokenVersion: true,
} as const satisfies Prisma.UserSelect;

const REFRESH_TOKEN_WITH_USER_INCLUDE = {
    user: { select: AUTH_REFRESH_USER_SELECT },
} as const satisfies Prisma.AuthRefreshTokenInclude;

type RefreshTokenStore = Pick<Prisma.TransactionClient, "authRefreshToken">;

export type RefreshTokenWithUser = Prisma.AuthRefreshTokenGetPayload<{
    include: typeof REFRESH_TOKEN_WITH_USER_INCLUDE;
}>;

export type RefreshSessionRecord = {
    id: string;
    familyId: string;
    createdAt: Date;
    lastUsedAt: Date | null;
    expiresAt: Date;
    userAgent: string | null;
    ipAddress: string | null;
};

export type RefreshRotationResult =
    | { status: "rotated" }
    | { status: "alreadyRotated" }
    | { status: "invalid" };

export interface RefreshTokenDraftRecord {
    userId: number;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
}

export async function createRefreshToken(record: RefreshTokenDraftRecord): Promise<void> {
    await prisma.authRefreshToken.create({
        data: {
            userId: record.userId,
            tokenHash: record.tokenHash,
            familyId: record.familyId,
            expiresAt: record.expiresAt,
            userAgent: record.userAgent,
            ipAddress: record.ipAddress,
        },
    });
}

export async function findRefreshTokenByHash(
    tokenHash: string,
): Promise<RefreshTokenWithUser | null> {
    return prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        include: REFRESH_TOKEN_WITH_USER_INCLUDE,
    });
}

export async function hasActiveSessionFamily(
    userId: number,
    familyId: string,
): Promise<boolean> {
    const session = await prisma.authRefreshToken.findFirst({
        where: {
            userId,
            familyId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: { id: true },
    });

    return session !== null;
}

export async function findRefreshTokenFamily(
    tokenHash: string,
): Promise<{ userId: number; familyId: string } | null> {
    return prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true, familyId: true },
    });
}

export async function revokeRefreshFamily(
    familyId: string,
    revokedAt = new Date(),
): Promise<void> {
    await prisma.authRefreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt },
    });
}

export async function revokeAllRefreshTokensForUser(
    userId: number,
    revokedAt = new Date(),
): Promise<void> {
    await prisma.authRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
    });
}

export async function revokeAllRefreshTokensForUserInTransaction(
    tx: Prisma.TransactionClient,
    userId: number,
    revokedAt: Date,
): Promise<void> {
    await tx.authRefreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
    });
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

async function hasSuccessorToken(
    rotatedFromId: string,
    client: RefreshTokenStore,
): Promise<boolean> {
    const successor = await client.authRefreshToken.findFirst({
        where: {
            rotatedFromId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: { id: true },
    });

    return successor !== null;
}

export async function rotateRefreshTokenAtomically(input: {
    tokenId: string;
    now: Date;
    nextToken: RefreshTokenDraftRecord;
}): Promise<RefreshRotationResult> {
    return prisma.$transaction(async (tx) => {
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
                    userId: input.nextToken.userId,
                    tokenHash: input.nextToken.tokenHash,
                    familyId: input.nextToken.familyId,
                    rotatedFromId: input.tokenId,
                    expiresAt: input.nextToken.expiresAt,
                    userAgent: input.nextToken.userAgent,
                    ipAddress: input.nextToken.ipAddress,
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
}

export async function revokeCurrentRefreshToken(
    tokenHash: string,
): Promise<{ userId: number; email: string } | null> {
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

export async function listActiveRefreshSessions(
    userId: number,
    now: Date,
): Promise<RefreshSessionRecord[]> {
    return prisma.authRefreshToken.findMany({
        where: {
            userId,
            revokedAt: null,
            expiresAt: { gt: now },
        },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            familyId: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
            userAgent: true,
            ipAddress: true,
        },
    });
}

export async function findActiveOwnedRefreshToken(
    tokenId: string,
    userId: number,
    now: Date,
): Promise<{ familyId: string; email: string } | null> {
    const tokenRecord = await prisma.authRefreshToken.findFirst({
        where: {
            id: tokenId,
            userId,
            revokedAt: null,
            expiresAt: { gt: now },
        },
        include: {
            user: {
                select: { email: true },
            },
        },
    });

    if (!tokenRecord) return null;
    return { familyId: tokenRecord.familyId, email: tokenRecord.user.email };
}

export async function cleanupRefreshTokens(retentionCutoff: Date): Promise<number> {
    const { count } = await prisma.authRefreshToken.deleteMany({
        where: {
            OR: [
                { revokedAt: { not: null, lt: retentionCutoff } },
                { expiresAt: { lt: retentionCutoff } },
            ],
        },
    });

    return count;
}
