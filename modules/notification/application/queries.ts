import {
    countHistoryNotifications,
    countUnreadNotifications,
    findHistoryNotifications,
    findLatestNotifications,
} from "../infrastructure/persistence/repository";
import {
    decodeNotificationHistoryCursor,
    encodeNotificationHistoryCursor,
} from "./history-cursor";
import type {
    NotificationHistoryQuery,
    NotificationHistoryResult,
    NotificationLatestResult,
} from "./types";

const LATEST_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 20;

export async function listLatestForUser(
    userId: number,
): Promise<NotificationLatestResult> {
    const [notifications, unreadCount] = await Promise.all([
        findLatestNotifications(userId, LATEST_PAGE_SIZE),
        countUnreadNotifications(userId),
    ]);

    return { notifications, unreadCount };
}

export async function listHistoryForUser(
    input: NotificationHistoryQuery,
): Promise<NotificationHistoryResult> {
    const filter = input.filter ?? null;
    const cursor = decodeNotificationHistoryCursor(input.cursor ?? null);
    const [notifications, totalCount] = await Promise.all([
        findHistoryNotifications(input.userId, {
            filter,
            cursor,
            take: HISTORY_PAGE_SIZE + 1,
        }),
        countHistoryNotifications(input.userId, filter),
    ]);

    const hasMore = notifications.length > HISTORY_PAGE_SIZE;
    const items = hasMore
        ? notifications.slice(0, HISTORY_PAGE_SIZE)
        : notifications;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem !== undefined
        ? encodeNotificationHistoryCursor(lastItem)
        : null;

    return {
        notifications: items,
        nextCursor,
        hasMore,
        totalCount,
    };
}
