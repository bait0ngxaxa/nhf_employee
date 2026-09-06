import { Role, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    createForUserOnce,
    type NotificationCreateInput,
    type NotificationPersistenceContext,
} from "@/modules/notification";

type InAppNotificationClient = NotificationPersistenceContext & Pick<
    Prisma.TransactionClient,
    "user"
>;

export type InAppNotificationInput = Omit<NotificationCreateInput, "userId"> & {
    userId: number | null | undefined;
};

type AdminNotificationInput = Omit<
    InAppNotificationInput,
    "userId" | "dedupeKey"
> & {
    dedupeKeyPrefix: string;
};

export async function createInAppNotificationOnce(
    input: InAppNotificationInput,
    client: InAppNotificationClient = prisma,
): Promise<void> {
    const { userId, ...notificationInput } = input;
    if (!userId) {
        return;
    }

    await createForUserOnce({ ...notificationInput, userId }, client);
}

export async function createAdminInAppNotificationsOnce(
    input: AdminNotificationInput,
    client: InAppNotificationClient = prisma,
): Promise<void> {
    const admins = await client.user.findMany({
        where: {
            role: Role.ADMIN,
            isActive: true,
            deletedAt: null,
        },
        select: { id: true },
    });

    await Promise.all(
        admins.map((admin) =>
            createInAppNotificationOnce({
                ...input,
                userId: admin.id,
                dedupeKey: `${input.dedupeKeyPrefix}:${admin.id}`,
            }, client),
        ),
    );
}
