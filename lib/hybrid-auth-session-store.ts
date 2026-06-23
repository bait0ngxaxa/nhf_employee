import { prisma } from "@/lib/prisma";

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
