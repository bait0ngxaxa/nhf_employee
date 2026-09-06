import { Prisma, type Notification } from "@prisma/client";

import {
    createNotification,
    updateAllNotificationsReadState,
    updateNotificationReadState,
} from "../infrastructure/persistence/repository";
import type {
    NotificationCreateInput,
    NotificationPersistenceContext,
} from "./types";

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
    );
}

export function markReadForUser(
    notificationId: string,
    userId: number,
): Promise<Notification> {
    return updateNotificationReadState(notificationId, userId);
}

export async function markAllReadForUser(userId: number): Promise<number> {
    const result = await updateAllNotificationsReadState(userId);
    return result.count;
}

export async function createForUserOnce(
    input: NotificationCreateInput,
    persistenceContext?: NotificationPersistenceContext,
): Promise<void> {
    try {
        await createNotification({
            ...input,
            dedupeKey: input.dedupeKey ?? null,
        }, persistenceContext);
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return;
        }
        throw error;
    }
}
