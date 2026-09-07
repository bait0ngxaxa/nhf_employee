import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type PasswordResetRecord = Prisma.PasswordResetTokenGetPayload<{
    select: {
        id: true;
        email: true;
        expiresAt: true;
        used: true;
    };
}>;

export async function countRecentPasswordResetRequests(
    email: string,
    since: Date,
): Promise<number> {
    return prisma.passwordResetToken.count({
        where: {
            email,
            createdAt: { gte: since },
        },
    });
}

export async function deleteUnusedPasswordResetTokens(email: string): Promise<void> {
    await prisma.passwordResetToken.deleteMany({
        where: { email, used: false },
    });
}

export async function createPasswordResetToken(input: {
    token: string;
    email: string;
    expiresAt: Date;
}): Promise<void> {
    await prisma.passwordResetToken.create({ data: input });
}

export async function findPasswordResetToken(
    token: string,
): Promise<PasswordResetRecord | null> {
    return prisma.passwordResetToken.findUnique({
        where: { token },
        select: {
            id: true,
            email: true,
            expiresAt: true,
            used: true,
        },
    });
}

export async function claimPasswordResetToken(
    tx: Prisma.TransactionClient,
    tokenId: number,
    claimedAt: Date,
): Promise<boolean> {
    const claim = await tx.passwordResetToken.updateMany({
        where: {
            id: tokenId,
            used: false,
            expiresAt: { gt: claimedAt },
        },
        data: { used: true },
    });

    return claim.count === 1;
}
