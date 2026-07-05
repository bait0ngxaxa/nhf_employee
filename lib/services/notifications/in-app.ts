import { Prisma, type NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type InAppNotificationInput = {
    userId: number | null | undefined;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl: string | null;
    referenceId: string | null;
    dedupeKey?: string | null;
};

type AdminNotificationInput = Omit<
    InAppNotificationInput,
    "userId" | "dedupeKey"
> & {
    dedupeKeyPrefix: string;
};

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

export async function createInAppNotificationOnce(
    input: InAppNotificationInput,
): Promise<void> {
    if (!input.userId) {
        return;
    }

    try {
        await prisma.notification.create({
            data: {
                userId: input.userId,
                type: input.type,
                title: input.title,
                message: input.message,
                actionUrl: input.actionUrl,
                referenceId: input.referenceId,
                dedupeKey: input.dedupeKey ?? null,
            },
        });
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return;
        }
        throw error;
    }
}

export async function createAdminInAppNotificationsOnce(
    input: AdminNotificationInput,
): Promise<void> {
    const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
    });

    await Promise.all(
        admins.map((admin) =>
            createInAppNotificationOnce({
                ...input,
                userId: admin.id,
                dedupeKey: `${input.dedupeKeyPrefix}:${admin.id}`,
            }),
        ),
    );
}
