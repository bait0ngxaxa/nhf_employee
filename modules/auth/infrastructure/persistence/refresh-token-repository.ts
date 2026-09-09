import type { Prisma, Role } from "@prisma/client";

import { hasEligibleEmployeeLifecycle } from "@/modules/employee";
import { lockUserRows } from "@/lib/db/row-locks";
import { prisma } from "@/lib/db/prisma";

const AUTH_REFRESH_USER_SELECT = {
    id: true,
    email: true,
    role: true,
    isActive: true,
    tokenVersion: true,
    deletedAt: true,
    employee: {
        select: {
            status: true,
            deletedAt: true,
        },
    },
} as const satisfies Prisma.UserSelect;

const REFRESH_TOKEN_WITH_USER_INCLUDE = {
    user: { select: AUTH_REFRESH_USER_SELECT },
} as const satisfies Prisma.AuthRefreshTokenInclude;

type RefreshTokenStore = Pick<Prisma.TransactionClient, "authRefreshToken">;

export const AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS = 5_000;

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
    | { status: "rotated"; account: { role: Role; tokenVersion: number } }
    | { status: "concurrentCompletion" }
    | { status: "confirmedReuse" }
    | { status: "expired" }
    | { status: "revoked" }
    | { status: "inactiveAccount" }
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
    await prisma.$transaction(async (tx) => {
        const familyToken = await tx.authRefreshToken.findFirst({
            where: { familyId },
            select: { userId: true },
        });
        if (!familyToken) return;

        await lockUserRows(tx, [familyToken.userId]);
        await tx.authRefreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt },
        });
    });
}

export async function revokeAllRefreshTokensForUser(
    userId: number,
    revokedAt = new Date(),
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await lockUserRows(tx, [userId]);
        await tx.authRefreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt },
        });
    });
}

export async function revokeAllRefreshTokensForUserInTransaction(
    tx: Prisma.TransactionClient,
    userId: number,
    revokedAt: Date,
): Promise<void> {
    await lockUserRows(tx, [userId]);
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

type RefreshTransactionUser = Prisma.UserGetPayload<{
    select: typeof AUTH_REFRESH_USER_SELECT;
}>;

async function findActiveSuccessor(
    rotatedFromId: string,
    now: Date,
    client: RefreshTokenStore,
): Promise<{ id: string; lastUsedAt: Date | null } | null> {
    return client.authRefreshToken.findFirst({
        where: {
            rotatedFromId,
            revokedAt: null,
            expiresAt: { gt: now },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, lastUsedAt: true },
    });
}

function isWithinConcurrentCompletionWindow(input: {
    sourceRevokedAt: Date;
    sourceLastUsedAt: Date | null;
    now: Date;
}): boolean {
    if (input.sourceLastUsedAt === null) return false;

    return Math.abs(input.now.getTime() - input.sourceRevokedAt.getTime())
        <= AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS;
}

async function classifyRevokedSource(input: {
    tokenId: string;
    familyId: string;
    sourceRevokedAt: Date;
    sourceLastUsedAt: Date | null;
    now: Date;
    client: RefreshTokenStore;
}): Promise<Extract<RefreshRotationResult, { status: "concurrentCompletion" | "confirmedReuse" | "revoked" }>> {
    const successor = await findActiveSuccessor(
        input.tokenId,
        input.now,
        input.client,
    );
    if (
        successor?.lastUsedAt === null
        && isWithinConcurrentCompletionWindow(input)
    ) {
        const marked = await input.client.authRefreshToken.updateMany({
            where: {
                id: successor.id,
                rotatedFromId: input.tokenId,
                revokedAt: null,
                expiresAt: { gt: input.now },
                lastUsedAt: null,
            },
            data: { lastUsedAt: input.now },
        });
        if (marked.count === 1) {
            return { status: "concurrentCompletion" };
        }
    }

    if (input.sourceLastUsedAt !== null) {
        await input.client.authRefreshToken.updateMany({
            where: { familyId: input.familyId, revokedAt: null },
            data: { revokedAt: input.now },
        });
        return { status: "confirmedReuse" };
    }

    return { status: "revoked" };
}

function isRefreshAccountEligible(user: RefreshTransactionUser): boolean {
    return user.isActive
        && user.deletedAt === null
        && hasEligibleEmployeeLifecycle(user.employee);
}

export async function rotateRefreshTokenAtomically(input: {
    userId: number;
    tokenId: string;
    now: Date;
    nextToken: RefreshTokenDraftRecord;
}): Promise<RefreshRotationResult> {
    return prisma.$transaction(async (tx) => {
        await lockUserRows(tx, [input.userId]);

        const user = await tx.user.findUnique({
            where: { id: input.userId },
            select: AUTH_REFRESH_USER_SELECT,
        });
        const source = await tx.authRefreshToken.findUnique({
            where: { id: input.tokenId },
            select: {
                userId: true,
                familyId: true,
                revokedAt: true,
                expiresAt: true,
                lastUsedAt: true,
            },
        });

        if (
            !user
            || !source
            || source.userId !== input.userId
            || source.familyId !== input.nextToken.familyId
        ) {
            return { status: "invalid" as const };
        }

        if (!isRefreshAccountEligible(user)) {
            await tx.authRefreshToken.updateMany({
                where: { familyId: source.familyId, revokedAt: null },
                data: { revokedAt: input.now },
            });
            return { status: "inactiveAccount" as const };
        }

        if (source.revokedAt !== null) {
            return classifyRevokedSource({
                tokenId: input.tokenId,
                familyId: source.familyId,
                sourceRevokedAt: source.revokedAt,
                sourceLastUsedAt: source.lastUsedAt,
                now: input.now,
                client: tx,
            });
        }

        if (source.expiresAt <= input.now) {
            await tx.authRefreshToken.updateMany({
                where: { familyId: source.familyId, revokedAt: null },
                data: { revokedAt: input.now },
            });
            return { status: "expired" as const };
        }

        const claimedToken = await tx.authRefreshToken.updateMany({
            where: { id: input.tokenId, revokedAt: null },
            data: { revokedAt: input.now, lastUsedAt: input.now },
        });

        if (claimedToken.count === 0) {
            const latestSource = await tx.authRefreshToken.findUnique({
                where: { id: input.tokenId },
                select: {
                    familyId: true,
                    revokedAt: true,
                    lastUsedAt: true,
                },
            });
            if (!latestSource) return { status: "invalid" as const };
            if (latestSource.revokedAt !== null) {
                return classifyRevokedSource({
                    tokenId: input.tokenId,
                    familyId: latestSource.familyId,
                    sourceRevokedAt: latestSource.revokedAt,
                    sourceLastUsedAt: latestSource.lastUsedAt,
                    now: input.now,
                    client: tx,
                });
            }
            return { status: "invalid" as const };
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
                return classifyRevokedSource({
                    tokenId: input.tokenId,
                    familyId: source.familyId,
                    sourceRevokedAt: input.now,
                    sourceLastUsedAt: input.now,
                    now: input.now,
                    client: tx,
                });
            }
            throw error;
        }

        return {
            status: "rotated" as const,
            account: {
                role: user.role,
                tokenVersion: user.tokenVersion ?? 1,
            },
        };
    });
}

export async function revokeCurrentRefreshToken(
    tokenHash: string,
): Promise<{ userId: number; email: string } | null> {
    const tokenReference = await prisma.authRefreshToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
    });

    if (!tokenReference) return null;

    return prisma.$transaction(async (tx) => {
        await lockUserRows(tx, [tokenReference.userId]);

        const tokenRecord = await tx.authRefreshToken.findUnique({
            where: { tokenHash },
            include: {
                user: {
                    select: { id: true, email: true },
                },
            },
        });
        if (!tokenRecord) return null;

        const familyRows = await tx.authRefreshToken.count({
            where: {
                userId: tokenRecord.user.id,
                familyId: tokenRecord.familyId,
                revokedAt: null,
            },
        });
        if (familyRows === 0) return null;

        await tx.authRefreshToken.updateMany({
            where: {
                userId: tokenRecord.user.id,
                familyId: tokenRecord.familyId,
                revokedAt: null,
            },
            data: { revokedAt: new Date() },
        });

        return { userId: tokenRecord.user.id, email: tokenRecord.user.email };
    });
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
