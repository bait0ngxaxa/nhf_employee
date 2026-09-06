import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import type { NotificationCreateInput } from "../../application/types";
import {
    countHistoryNotifications,
    countUnreadNotifications,
    createNotification,
    findHistoryNotifications,
    findLatestNotifications,
    updateAllNotificationsReadState,
    updateNotificationReadState,
} from "./repository";

const persistenceContext = mockDeep<Prisma.TransactionClient>();

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("Notification persistence repository", () => {
    beforeEach(() => {
        mockReset(persistenceContext);
        persistenceContext.notification.findMany.mockResolvedValue(asNever([]));
        persistenceContext.notification.count.mockResolvedValue(0);
        persistenceContext.notification.update.mockResolvedValue(asNever({}));
        persistenceContext.notification.updateMany.mockResolvedValue({ count: 0 });
        persistenceContext.notification.create.mockResolvedValue(asNever({}));
    });

    it("queries the latest ten rows for one user in descending creation order", async () => {
        await findLatestNotifications(17, 10, persistenceContext);

        expect(persistenceContext.notification.findMany).toHaveBeenCalledWith({
            where: { userId: 17 },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
    });

    it("counts unread rows for the same user", async () => {
        await countUnreadNotifications(17, persistenceContext);

        expect(persistenceContext.notification.count).toHaveBeenCalledWith({
            where: { userId: 17, isRead: false },
        });
    });

    it("queries unread history with the timestamp cursor and page-size-plus-one", async () => {
        const cursor = "2026-08-01T00:00:00.000Z";

        await findHistoryNotifications(17, {
            filter: "unread",
            cursor,
            take: 21,
        }, persistenceContext);

        expect(persistenceContext.notification.findMany).toHaveBeenCalledWith({
            where: {
                userId: 17,
                isRead: false,
                createdAt: { lt: new Date(cursor) },
            },
            orderBy: { createdAt: "desc" },
            take: 21,
        });
        await countHistoryNotifications(17, "unread", persistenceContext);
        expect(persistenceContext.notification.count).toHaveBeenCalledWith({
            where: { userId: 17, isRead: false },
        });
    });

    it("keeps other history filters on the all-notifications query", async () => {
        await findHistoryNotifications(17, {
            filter: "all",
            cursor: null,
            take: 21,
        }, persistenceContext);
        await countHistoryNotifications(17, "other", persistenceContext);

        expect(persistenceContext.notification.findMany).toHaveBeenCalledWith({
            where: { userId: 17 },
            orderBy: { createdAt: "desc" },
            take: 21,
        });
        expect(persistenceContext.notification.count).toHaveBeenCalledWith({
            where: { userId: 17 },
        });
    });

    it("scopes mark-one-read by notification ID and user ID", async () => {
        await updateNotificationReadState("notification-17", 17, persistenceContext);

        expect(persistenceContext.notification.update).toHaveBeenCalledWith({
            where: { id: "notification-17", userId: 17 },
            data: { isRead: true },
        });
    });

    it("updates only unread rows for mark-all-read and returns the affected count", async () => {
        persistenceContext.notification.updateMany.mockResolvedValue({ count: 4 });

        await expect(
            updateAllNotificationsReadState(17, persistenceContext),
        ).resolves.toEqual({ count: 4 });
        expect(persistenceContext.notification.updateMany).toHaveBeenCalledWith({
            where: { userId: 17, isRead: false },
            data: { isRead: true },
        });
    });

    it("creates all supplied Inbox fields through the supplied transaction context", async () => {
        const input: NotificationCreateInput = {
            userId: 17,
            type: "SYSTEM_ALERT",
            title: "แจ้งเตือน",
            message: "รายละเอียด",
            actionUrl: "/dashboard/notifications",
            referenceId: "reference-17",
            dedupeKey: "notification:17:once",
        };

        await createNotification(input, persistenceContext);

        expect(persistenceContext.notification.create).toHaveBeenCalledWith({
            data: input,
        });
    });

    it("persists an omitted dedupe key as null", async () => {
        await createNotification({
            userId: 17,
            type: "SYSTEM_ALERT",
            title: "แจ้งเตือน",
            message: "รายละเอียด",
            actionUrl: null,
            referenceId: null,
        }, persistenceContext);

        expect(persistenceContext.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ dedupeKey: null }),
        });
    });
});
