import type { Prisma, PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import {
    createAdminInAppNotificationsOnce,
    createInAppNotificationOnce,
    type InAppNotificationInput,
} from "@/lib/services/notifications/in-app";

const notificationMocks = vi.hoisted(() => ({
    createForUserOnce: vi.fn(),
}));

vi.mock("@/modules/notification", () => notificationMocks);
vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const persistenceContext = mockDeep<Prisma.TransactionClient>();

const notificationInput: InAppNotificationInput = {
    userId: 17,
    type: "SYSTEM_ALERT",
    title: "แจ้งเตือน",
    message: "รายละเอียด",
    actionUrl: "/dashboard/notifications",
    referenceId: "reference-17",
    dedupeKey: "notification:17:once",
};

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("legacy in-app notification compatibility helper", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReset(persistenceContext);
        notificationMocks.createForUserOnce.mockResolvedValue(undefined);
    });

    it("adapts an explicit user write to the Notification public command", async () => {
        await createInAppNotificationOnce(notificationInput, persistenceContext);

        expect(notificationMocks.createForUserOnce).toHaveBeenCalledWith(
            notificationInput,
            persistenceContext,
        );
    });

    it.each([null, undefined, 0])("keeps skipping a falsy user ID: %s", async (userId) => {
        await createInAppNotificationOnce({ ...notificationInput, userId }, persistenceContext);

        expect(notificationMocks.createForUserOnce).not.toHaveBeenCalled();
    });

    it("keeps admin audience lookup outside Notification", async () => {
        persistenceContext.user.findMany.mockResolvedValue(asNever([{ id: 21 }, { id: 22 }]));

        await createAdminInAppNotificationsOnce({
            type: "SYSTEM_ALERT",
            title: "แจ้งเตือนผู้ดูแล",
            message: "รายละเอียด",
            actionUrl: null,
            referenceId: "reference-admin",
            dedupeKeyPrefix: "admin:reference",
        }, persistenceContext);

        expect(persistenceContext.user.findMany).toHaveBeenCalledWith({
            where: {
                role: "ADMIN",
                isActive: true,
                deletedAt: null,
            },
            select: { id: true },
        });
        expect(notificationMocks.createForUserOnce).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ userId: 21, dedupeKey: "admin:reference:21" }),
            persistenceContext,
        );
        expect(notificationMocks.createForUserOnce).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ userId: 22, dedupeKey: "admin:reference:22" }),
            persistenceContext,
        );
    });
});
