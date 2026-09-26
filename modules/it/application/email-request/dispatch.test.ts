import type { NotificationOutbox } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createInbox: vi.fn(),
    sendLine: vi.fn(),
}));

vi.mock("./notifications", () => ({
    createEmailRequestInboxNotifications: mocks.createInbox,
}));
vi.mock("../../infrastructure/notifications/email-request-line", () => ({
    sendEmailRequestLineNotification: mocks.sendLine,
}));

import {
    dispatchITEmailRequestOutbox,
    parseEmailRequestOutboxPayload,
} from "./dispatch";

function buildOutbox(
    payload: string,
    type: NotificationOutbox["type"] = "EMAIL_REQUEST",
): NotificationOutbox {
    const now = new Date("2026-09-25T00:00:00.000Z");
    return {
        id: 42,
        type,
        eventKey: "email-request:42:created",
        payload,
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        updatedAt: now,
    };
}

const historicalPayload = {
    thaiName: "สมชาย ใจดี",
    englishName: "Somchai Jaidee",
    phone: "081-2345678",
    position: "IT Officer",
    department: "มสช.",
    replyEmail: "somchai@example.com",
    requestedAt: "2026-09-20T03:00:00.000Z",
    sharedDriveAccess: null,
};

describe("IT Email Request outbox dispatcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.sendLine.mockResolvedValue(true);
    });

    it("keeps historical payloads with absent optional fields readable", () => {
        expect(parseEmailRequestOutboxPayload(historicalPayload)).toEqual({
            ...historicalPayload,
            nickname: "",
            needsDocumentSystem: false,
            sharedDriveAccess: [],
        });
    });

    it("dispatches Inbox semantics before LINE and forwards the stable retry key", async () => {
        const notification = buildOutbox(JSON.stringify(historicalPayload));

        await expect(dispatchITEmailRequestOutbox(
            notification,
            "123e4567-e89b-52d3-a456-426614174000",
        )).resolves.toBe("SENT");

        const dispatchedPayload = {
            ...historicalPayload,
            nickname: "",
            needsDocumentSystem: false,
            sharedDriveAccess: [],
        };
        expect(mocks.createInbox).toHaveBeenCalledWith(dispatchedPayload);
        expect(mocks.sendLine).toHaveBeenCalledWith(
            dispatchedPayload,
            "123e4567-e89b-52d3-a456-426614174000",
        );
        expect(mocks.createInbox.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.sendLine.mock.invocationCallOrder[0],
        );
    });

    it("rejects malformed JSON and invalid business fields before delivery", async () => {
        await expect(dispatchITEmailRequestOutbox(buildOutbox("{"), "retry-key"))
            .rejects.toThrow("Invalid EMAIL_REQUEST payload JSON");
        await expect(dispatchITEmailRequestOutbox(buildOutbox(JSON.stringify({
            ...historicalPayload,
            sharedDriveAccess: ["unknown_drive"],
        })), "retry-key")).rejects.toThrow(
            "Invalid EMAIL_REQUEST sharedDriveAccess payload",
        );
        expect(mocks.createInbox).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("does not claim other outbox types", async () => {
        await expect(dispatchITEmailRequestOutbox(
            buildOutbox("{}", "LEAVE_ACTION"),
            "retry-key",
        )).resolves.toBeNull();
        expect(mocks.createInbox).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });
});
