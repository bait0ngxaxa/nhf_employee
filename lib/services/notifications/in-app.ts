import { prisma } from "@/lib/db/prisma";
import {
    createForUserOnce,
    type NotificationCreateInput,
    type NotificationPersistenceContext,
} from "@/modules/notification";

export type InAppNotificationInput = Omit<NotificationCreateInput, "userId"> & {
    userId: number | null | undefined;
};

type InAppNotificationClient = NotificationPersistenceContext;

// Deferred Email Request compatibility adapter. Keep this explicit-user shape
// until the future IT ownership migration is approved.
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
