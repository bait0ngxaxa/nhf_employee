import { Prisma, type Notification } from "@prisma/client";

import {
    createNotification,
    createNotifications,
    updateAllNotificationsReadState,
    updateUnreadNotificationsByReference,
    updateNotificationReadState,
} from "../infrastructure/persistence/repository";
import type {
    NotificationCreateInput,
    NotificationPersistenceContext,
    NotificationReadTransitionInput,
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

export async function markUnreadByReferenceForUser(
    input: NotificationReadTransitionInput,
    persistenceContext?: NotificationPersistenceContext,
): Promise<number> {
    const result = await updateUnreadNotificationsByReference(
        input,
        persistenceContext,
    );
    return result.count;
}

export async function createForUser(
    input: NotificationCreateInput,
    persistenceContext?: NotificationPersistenceContext,
): Promise<void> {
    await createNotification({
        ...input,
        dedupeKey: input.dedupeKey ?? null,
    }, persistenceContext);
}

export async function createForUserOnce(
    input: NotificationCreateInput,
    persistenceContext?: NotificationPersistenceContext,
): Promise<void> {
    try {
        await createForUser(input, persistenceContext);
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return;
        }
        throw error;
    }
}

export async function createForUsers(
    inputs: readonly NotificationCreateInput[],
    persistenceContext?: NotificationPersistenceContext,
): Promise<number> {
    if (inputs.length === 0) return 0;

    const result = await createNotifications(
        inputs.map((input) => ({
            ...input,
            dedupeKey: input.dedupeKey ?? null,
        })),
        persistenceContext,
    );
    return result.count;
}
