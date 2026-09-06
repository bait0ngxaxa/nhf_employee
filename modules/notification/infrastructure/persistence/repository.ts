import type { Notification, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
    NotificationCreateInput,
    NotificationPersistenceContext,
} from "../../application/types";

type HistoryQueryOptions = {
    filter: string | null;
    cursor: string | null;
    take: number;
};

function buildHistoryWhere(
    userId: number,
    filter: string | null,
): Prisma.NotificationWhereInput {
    return {
        userId,
        ...(filter === "unread" ? { isRead: false } : {}),
    };
}

export function findLatestNotifications(
    userId: number,
    take: number,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<Notification[]> {
    return persistenceContext.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
    });
}

export function countUnreadNotifications(
    userId: number,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<number> {
    return persistenceContext.notification.count({
        where: { userId, isRead: false },
    });
}

export function findHistoryNotifications(
    userId: number,
    options: HistoryQueryOptions,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<Notification[]> {
    return persistenceContext.notification.findMany({
        where: {
            ...buildHistoryWhere(userId, options.filter),
            ...(options.cursor
                ? { createdAt: { lt: new Date(options.cursor) } }
                : {}),
        },
        orderBy: { createdAt: "desc" },
        take: options.take,
    });
}

export function countHistoryNotifications(
    userId: number,
    filter: string | null,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<number> {
    return persistenceContext.notification.count({
        where: buildHistoryWhere(userId, filter),
    });
}

export function updateNotificationReadState(
    notificationId: string,
    userId: number,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<Notification> {
    return persistenceContext.notification.update({
        where: {
            id: notificationId,
            userId,
        },
        data: {
            isRead: true,
        },
    });
}

export function updateAllNotificationsReadState(
    userId: number,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<Prisma.BatchPayload> {
    return persistenceContext.notification.updateMany({
        where: {
            userId,
            isRead: false,
        },
        data: {
            isRead: true,
        },
    });
}

export function createNotification(
    input: NotificationCreateInput,
    persistenceContext: NotificationPersistenceContext = prisma,
): Promise<Notification> {
    return persistenceContext.notification.create({
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
}
