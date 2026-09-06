import type { Prisma, PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import {
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

});
