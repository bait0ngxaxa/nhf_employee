import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    listHistoryForUser,
    listLatestForUser,
} from "./queries";
import { encodeNotificationHistoryCursor } from "./history-cursor";

const repositoryMocks = vi.hoisted(() => ({
    countHistoryNotifications: vi.fn(),
    countUnreadNotifications: vi.fn(),
    findHistoryNotifications: vi.fn(),
    findLatestNotifications: vi.fn(),
}));

vi.mock("../infrastructure/persistence/repository", () => repositoryMocks);

describe("Notification application queries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        repositoryMocks.countHistoryNotifications.mockResolvedValue(0);
        repositoryMocks.countUnreadNotifications.mockResolvedValue(0);
        repositoryMocks.findHistoryNotifications.mockResolvedValue([]);
        repositoryMocks.findLatestNotifications.mockResolvedValue([]);
    });

    it("passes the user to both latest-row and unread-count repository queries", async () => {
        const notifications = [{ id: "latest-1" }];
        repositoryMocks.findLatestNotifications.mockResolvedValue(notifications);
        repositoryMocks.countUnreadNotifications.mockResolvedValue(2);

        await expect(listLatestForUser(17)).resolves.toEqual({
            notifications,
            unreadCount: 2,
        });
        expect(repositoryMocks.findLatestNotifications).toHaveBeenCalledWith(17, 10);
        expect(repositoryMocks.countUnreadNotifications).toHaveBeenCalledWith(17);
    });

    it("keeps unread history pagination at 20 items and derives the composite cursor", async () => {
        const notifications = Array.from({ length: 21 }, (_, index) => ({
            id: `notification-${index}`,
            createdAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
        }));
        const cursor = "2026-09-01T00:00:00.000Z";
        const expectedCursor = {
            kind: "legacy-timestamp" as const,
            createdAt: new Date(cursor),
        };
        const boundaryNotification = notifications[19];
        if (!boundaryNotification) {
            throw new Error("Missing history page boundary fixture");
        }
        repositoryMocks.findHistoryNotifications.mockResolvedValue(notifications);
        repositoryMocks.countHistoryNotifications.mockResolvedValue(25);

        await expect(listHistoryForUser({
            userId: 17,
            filter: "unread",
            cursor,
        })).resolves.toEqual({
            notifications: notifications.slice(0, 20),
            nextCursor: encodeNotificationHistoryCursor(boundaryNotification),
            hasMore: true,
            totalCount: 25,
        });
        expect(repositoryMocks.findHistoryNotifications).toHaveBeenCalledWith(17, {
            filter: "unread",
            cursor: expectedCursor,
            take: 21,
        });
        expect(repositoryMocks.countHistoryNotifications).toHaveBeenCalledWith(17, "unread");
    });

    it("keeps non-unread filters on the all-history path and returns no cursor at the end", async () => {
        const notifications = [{
            id: "notification-1",
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
        }];
        repositoryMocks.findHistoryNotifications.mockResolvedValue(notifications);
        repositoryMocks.countHistoryNotifications.mockResolvedValue(1);

        await expect(listHistoryForUser({ userId: 17, filter: "all" })).resolves.toEqual({
            notifications,
            nextCursor: null,
            hasMore: false,
            totalCount: 1,
        });
        expect(repositoryMocks.findHistoryNotifications).toHaveBeenCalledWith(17, {
            filter: "all",
            cursor: null,
            take: 21,
        });
        expect(repositoryMocks.countHistoryNotifications).toHaveBeenCalledWith(17, "all");
    });
});
