import { hasPrismaErrorCode } from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";

export class LineAccountLinkConflictError extends Error {
    constructor() {
        super("LINE account link conflict");
        this.name = "LineAccountLinkConflictError";
    }
}

interface LineAccountLinkRecord {
    userId: number;
    lineUserId: string;
}

const lineAccountLinkSelect = {
    userId: true,
    lineUserId: true,
} as const;

function isSameLink(
    link: LineAccountLinkRecord | null,
    userId: number,
    lineUserId: string,
): boolean {
    return link?.userId === userId && link.lineUserId === lineUserId;
}

function assertLinkInput(userId: number, lineUserId: string): void {
    if (
        !Number.isSafeInteger(userId)
        || userId <= 0
        || lineUserId.trim().length === 0
    ) {
        throw new Error("Invalid LINE account link identity");
    }
}

async function findLinkByUserId(
    userId: number,
): Promise<LineAccountLinkRecord | null> {
    return prisma.lineAccountLink.findUnique({
        where: { userId },
        select: lineAccountLinkSelect,
    });
}

async function findLinkByLineUserId(
    lineUserId: string,
): Promise<LineAccountLinkRecord | null> {
    return prisma.lineAccountLink.findUnique({
        where: { lineUserId },
        select: lineAccountLinkSelect,
    });
}

export async function findLineAccountLinkByLineUserId(
    lineUserId: string,
): Promise<{ userId: number } | null> {
    const link = await prisma.lineAccountLink.findUnique({
        where: { lineUserId },
        select: { userId: true },
    });
    return link;
}

export async function linkLineAccount(
    userId: number,
    lineUserId: string,
): Promise<{ idempotent: boolean }> {
    assertLinkInput(userId, lineUserId);

    const [linkByUser, linkByLine] = await Promise.all([
        findLinkByUserId(userId),
        findLinkByLineUserId(lineUserId),
    ]);

    if (linkByUser) {
        if (isSameLink(linkByUser, userId, lineUserId)) {
            return { idempotent: true };
        }
        throw new LineAccountLinkConflictError();
    }

    if (linkByLine) {
        if (isSameLink(linkByLine, userId, lineUserId)) {
            return { idempotent: true };
        }
        throw new LineAccountLinkConflictError();
    }

    try {
        await prisma.lineAccountLink.create({
            data: { userId, lineUserId },
            select: { id: true },
        });
        return { idempotent: false };
    } catch (error) {
        if (!hasPrismaErrorCode(error, "P2002")) {
            throw error;
        }

        const [linkAfterRaceByUser, linkAfterRaceByLine] = await Promise.all([
            findLinkByUserId(userId),
            findLinkByLineUserId(lineUserId),
        ]);

        if (
            isSameLink(linkAfterRaceByUser, userId, lineUserId)
            && isSameLink(linkAfterRaceByLine, userId, lineUserId)
        ) {
            return { idempotent: true };
        }

        throw new LineAccountLinkConflictError();
    }
}
