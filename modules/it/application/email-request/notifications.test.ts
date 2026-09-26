import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailRequestData } from "../../domain/email-request/contracts";

const findActiveUsersWithConfiguredCapabilityScopeMock = vi.hoisted(() => vi.fn());
const createForUserOnceMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/authorization", () => ({
    findActiveUsersWithConfiguredCapabilityScope:
        findActiveUsersWithConfiguredCapabilityScopeMock,
}));

vi.mock("@/modules/notification", () => ({
    createForUserOnce: createForUserOnceMock,
}));

import { createEmailRequestInboxNotifications } from "./notifications";

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

        await createEmailRequestInboxNotifications(payload);

        expect(findActiveUsersWithConfiguredCapabilityScopeMock).toHaveBeenCalledWith({
            capability: "email.request.read",
            scope: "ALL",
        });
        expect(createForUserOnceMock).toHaveBeenCalledTimes(2);
        expect(createForUserOnceMock.mock.calls.map(([input]) => input.userId))
            .toEqual([10, 11]);
        expect(createForUserOnceMock).toHaveBeenCalledWith(expect.objectContaining({
            type: "SYSTEM_ALERT",
            title: "มีคำขออีเมลพนักงานใหม่",
            message: "สมชาย ใจดี (IT Officer, IT) ส่งคำขออีเมลพนักงานใหม่",
            actionUrl: "/dashboard/email-request",
            referenceId: "somchai@example.com",
            dedupeKey: "email-request:somchai@example.com:2026-09-20T03:00:00.000Z:10",
        }));
    });

    it("does not resolve OWN-only authority as a broad request audience", async () => {
        findActiveUsersWithConfiguredCapabilityScopeMock.mockResolvedValue([10]);

        await createEmailRequestInboxNotifications(payload);

        expect(findActiveUsersWithConfiguredCapabilityScopeMock).toHaveBeenCalledWith({
            capability: "email.request.read",
            scope: "ALL",
        });
        expect(createForUserOnceMock.mock.calls.map(([input]) => input.userId))
            .toEqual([10]);
    });
});
