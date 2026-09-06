import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { NotificationCreateInput } from "./types";
import {
    createForUserOnce,
    markAllReadForUser,
    markReadForUser,
} from "./commands";

const repositoryMocks = vi.hoisted(() => ({
    createNotification: vi.fn(),
    updateAllNotificationsReadState: vi.fn(),
    updateNotificationReadState: vi.fn(),
}));

vi.mock("../infrastructure/persistence/repository", () => repositoryMocks);

const persistenceContext = mockDeep<Prisma.TransactionClient>();

const notificationInput: NotificationCreateInput = {
    userId: 17,
    type: "SYSTEM_ALERT",
    title: "แจ้งเตือน",
    message: "รายละเอียดการแจ้งเตือน",
    actionUrl: "/dashboard/notifications",
    referenceId: "reference-17",
    dedupeKey: "notification:17:once",
};

function uniqueConstraintError(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
    });
}

describe("Notification application commands", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        repositoryMocks.createNotification.mockResolvedValue({});
        repositoryMocks.updateAllNotificationsReadState.mockResolvedValue({ count: 0 });
        repositoryMocks.updateNotificationReadState.mockResolvedValue({});
    });

    it("passes the complete semantic input and supplied persistence context to create", async () => {
        await createForUserOnce(notificationInput, persistenceContext);

        expect(repositoryMocks.createNotification).toHaveBeenCalledWith(
            notificationInput,
            persistenceContext,
        );
    });

    it("defaults an omitted dedupe key to null", async () => {
        const input = { ...notificationInput, dedupeKey: undefined };

        await createForUserOnce(input, persistenceContext);

        expect(repositoryMocks.createNotification).toHaveBeenCalledWith(
            { ...input, dedupeKey: null },
            persistenceContext,
        );
    });

    it("swallows an existing P2002 conflict as an idempotent duplicate", async () => {
        const duplicateError = uniqueConstraintError();
        repositoryMocks.createNotification.mockRejectedValue(duplicateError);

        await expect(
            createForUserOnce(notificationInput, persistenceContext),
        ).resolves.toBeUndefined();
    });

    it("propagates non-P2002 create failures", async () => {
        const databaseError = new Error("database failure");
        repositoryMocks.createNotification.mockRejectedValue(databaseError);

        await expect(
            createForUserOnce(notificationInput, persistenceContext),
        ).rejects.toBe(databaseError);
    });

    it("marks one notification read through the user-scoped command", async () => {
        const notification = { id: "notification-17", isRead: true };
        repositoryMocks.updateNotificationReadState.mockResolvedValue(notification);

        await expect(markReadForUser("notification-17", 17)).resolves.toBe(notification);
        expect(repositoryMocks.updateNotificationReadState).toHaveBeenCalledWith(
            "notification-17",
            17,
        );
    });

    it("preserves mark-one persistence failures", async () => {
        const databaseError = new Error("database failure");
        repositoryMocks.updateNotificationReadState.mockRejectedValue(databaseError);

        await expect(markReadForUser("notification-17", 17)).rejects.toBe(databaseError);
    });

    it("returns the affected count for mark-all, including zero", async () => {
        repositoryMocks.updateAllNotificationsReadState.mockResolvedValueOnce({ count: 3 });
        await expect(markAllReadForUser(17)).resolves.toBe(3);
        expect(repositoryMocks.updateAllNotificationsReadState).toHaveBeenCalledWith(17);

        repositoryMocks.updateAllNotificationsReadState.mockResolvedValueOnce({ count: 0 });
        await expect(markAllReadForUser(17)).resolves.toBe(0);
    });
});
