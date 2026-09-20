import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailRequestData } from "@/types/api";

const findActiveUsersWithConfiguredCapabilityScopeMock = vi.hoisted(() => vi.fn());
const createInAppNotificationOnceMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/authorization", () => ({
    findActiveUsersWithConfiguredCapabilityScope:
        findActiveUsersWithConfiguredCapabilityScopeMock,
}));

vi.mock("@/lib/services/notifications/in-app", () => ({
    createInAppNotificationOnce: createInAppNotificationOnceMock,
}));

import { createEmailRequestInAppNotification } from "@/lib/services/email-request/notifications";

const payload: EmailRequestData = {
    thaiName: "สมชาย ใจดี",
    englishName: "Somchai Jaidee",
    phone: "0812345678",
    nickname: "ชาย",
    position: "IT Officer",
    department: "IT",
    replyEmail: "somchai@example.com",
    needsDocumentSystem: false,
    sharedDriveAccess: [],
    requestedAt: "2026-09-20T03:00:00.000Z",
};

describe("Email Request notification recipients", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses only configured email.request.read / ALL users", async () => {
        findActiveUsersWithConfiguredCapabilityScopeMock.mockResolvedValue([10, 11]);

        await createEmailRequestInAppNotification(payload);

        expect(findActiveUsersWithConfiguredCapabilityScopeMock).toHaveBeenCalledWith({
            capability: "email.request.read",
            scope: "ALL",
        });
        expect(createInAppNotificationOnceMock).toHaveBeenCalledTimes(2);
        expect(createInAppNotificationOnceMock.mock.calls.map(([input]) => input.userId))
            .toEqual([10, 11]);
    });

    it("does not resolve OWN-only authority as a broad request audience", async () => {
        findActiveUsersWithConfiguredCapabilityScopeMock.mockResolvedValue([10]);

        await createEmailRequestInAppNotification(payload);

        expect(findActiveUsersWithConfiguredCapabilityScopeMock).toHaveBeenCalledWith({
            capability: "email.request.read",
            scope: "ALL",
        });
        expect(createInAppNotificationOnceMock.mock.calls.map(([input]) => input.userId))
            .toEqual([10]);
    });
});
