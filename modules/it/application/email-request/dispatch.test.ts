import type { NotificationOutbox } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLineRetryKey } from "@/lib/services/outbox/provider-key";
import type {
    EmailRequestChannelOutboxPayloadV1,
} from "../../domain/email-request/contracts";
import {
    buildEmailRequestEmailEventKey,
    buildEmailRequestLineEventKey,
} from "./notifications";

const mocks = vi.hoisted(() => ({
    enqueueChannels: vi.fn(),
    authRecipients: vi.fn(),
    transaction: vi.fn(),
    requestSource: vi.fn(),
    recipientEmail: vi.fn(),
    sendEmail: vi.fn(),
    sendLine: vi.fn(),
}));

vi.mock("./notifications", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    enqueueEmailRequestNotificationChannels: mocks.enqueueChannels,
}));
vi.mock("@/modules/authorization", () => ({
    findActiveUsersWithConfiguredCapabilityScope: mocks.authRecipients,
}));
vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: mocks.transaction,
}));
vi.mock("../../infrastructure/persistence/email-request-repository", () => ({
    findEmailRequestNotificationSource: mocks.requestSource,
}));
vi.mock("../../infrastructure/persistence/ticket-notification-repository", () => ({
    findITTicketNotificationRecipientEmail: mocks.recipientEmail,
}));
vi.mock("../../infrastructure/notifications/email-request-email", () => ({
    sendEmailRequestEmailNotification: mocks.sendEmail,
}));
vi.mock("../../infrastructure/notifications/email-request-line", () => ({
    sendEmailRequestLineNotification: mocks.sendLine,
}));

import { dispatchITEmailRequestOutbox, parseEmailRequestOutboxPayload } from "./dispatch";

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

function buildOutbox(
    type: NotificationOutbox["type"],
    payload: string,
    eventKey: string | null = "email-request:42:created",
    id = 42,
): NotificationOutbox {
    const now = new Date("2026-09-25T00:00:00.000Z");
    return {
        id,
        type,
        eventKey,
        payload,
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
        createdAt: now,
        updatedAt: now,
    };
}

function buildChildPayload(
    overrides: Partial<EmailRequestChannelOutboxPayloadV1> = {},
): EmailRequestChannelOutboxPayloadV1 {
    return {
        version: 1,
        emailRequestId: 42,
        parentOutboxId: 900,
        recipientUserId: 10,
        ...overrides,
    };
}

function buildChildOutbox(
    type: "EMAIL_REQUEST_EMAIL" | "EMAIL_REQUEST_LINE",
    payload = buildChildPayload(),
): NotificationOutbox {
    const eventKey = type === "EMAIL_REQUEST_EMAIL"
        ? buildEmailRequestEmailEventKey(
            payload.emailRequestId,
            payload.parentOutboxId,
            payload.recipientUserId,
        )
        : buildEmailRequestLineEventKey(
            payload.emailRequestId,
            payload.parentOutboxId,
            payload.recipientUserId,
        );
    return buildOutbox(type, JSON.stringify(payload), eventKey, 100);
}

describe("IT Email Request outbox dispatcher", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enqueueChannels.mockResolvedValue(undefined);
        mocks.authRecipients.mockResolvedValue([10]);
        mocks.transaction.mockImplementation(async (
            operation: (tx: object) => Promise<unknown>,
        ) => operation({}));
        mocks.requestSource.mockResolvedValue({ id: 42 });
        mocks.recipientEmail.mockResolvedValue(" it@example.com ");
        mocks.sendEmail.mockResolvedValue(true);
        mocks.sendLine.mockResolvedValue({ status: "SENT" });
    });

    it("keeps historical parent payloads readable and fans out by persisted request identity", async () => {
        expect(parseEmailRequestOutboxPayload(historicalPayload)).toMatchObject({
            nickname: "",
            needsDocumentSystem: false,
            sharedDriveAccess: [],
        });

        const parent = buildOutbox(
            "EMAIL_REQUEST",
            JSON.stringify(historicalPayload),
        );
        await expect(dispatchITEmailRequestOutbox(parent)).resolves.toBe("SENT");

        expect(mocks.enqueueChannels).toHaveBeenCalledWith(
            42,
            42,
            expect.objectContaining({ replyEmail: "somchai@example.com" }),
        );
        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("rejects request ids outside the persisted Int range", () => {
        expect(() => parseEmailRequestOutboxPayload({
            ...historicalPayload,
            emailRequestId: 2_147_483_648,
        })).toThrow("Invalid EMAIL_REQUEST id");
    });

    it("uses parent outbox identity for a historical row without request identity", async () => {
        const parent = buildOutbox(
            "EMAIL_REQUEST",
            JSON.stringify(historicalPayload),
            null,
            901,
        );

        await expect(dispatchITEmailRequestOutbox(parent)).resolves.toBe("SENT");

        expect(mocks.enqueueChannels).toHaveBeenCalledWith(
            null,
            901,
            expect.anything(),
        );
    });

    it("sends Email only to the current configured user's account email", async () => {
        const payload = buildChildPayload();
        const row = buildChildOutbox("EMAIL_REQUEST_EMAIL", payload);

        await expect(dispatchITEmailRequestOutbox(row)).resolves.toBe("SENT");

        expect(mocks.requestSource).toHaveBeenCalledWith(expect.anything(), 42);
        expect(mocks.authRecipients).toHaveBeenCalledWith({
            capability: "email.request.read",
            scope: "ALL",
        }, expect.anything());
        expect(mocks.recipientEmail).toHaveBeenCalledWith(expect.anything(), 10);
        expect(mocks.sendEmail).toHaveBeenCalledWith(
            42,
            "it@example.com",
            10,
            900,
        );
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("sends personal LINE using the configured recipient's application user id", async () => {
        const payload = buildChildPayload({ recipientUserId: 10 });
        const row = buildChildOutbox("EMAIL_REQUEST_LINE", payload);

        await expect(dispatchITEmailRequestOutbox(row)).resolves.toBe("SENT");

        expect(mocks.sendLine).toHaveBeenCalledWith({
            userId: 10,
            emailRequestId: 42,
            retryKey: createLineRetryKey(row.eventKey ?? ""),
        });
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("supersedes a child after its user loses configured ALL authority", async () => {
        mocks.authRecipients.mockResolvedValueOnce([]);

        await expect(dispatchITEmailRequestOutbox(
            buildChildOutbox("EMAIL_REQUEST_EMAIL"),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("supersedes invalid account email without affecting LINE", async () => {
        mocks.recipientEmail.mockResolvedValueOnce("invalid\r\n@example.com");

        await expect(dispatchITEmailRequestOutbox(
            buildChildOutbox("EMAIL_REQUEST_EMAIL"),
        )).resolves.toBe("SUPERSEDED");

        expect(mocks.sendEmail).not.toHaveBeenCalled();
        expect(mocks.sendLine).not.toHaveBeenCalled();
    });

    it("supersedes an unavailable personal LINE recipient without retrying", async () => {
        mocks.sendLine.mockResolvedValueOnce({
            status: "SKIPPED",
            reason: "UNLINKED",
        });

        await expect(dispatchITEmailRequestOutbox(
            buildChildOutbox("EMAIL_REQUEST_LINE"),
        )).resolves.toBe("SUPERSEDED");
    });

    it("keeps Email and LINE child failures independent", async () => {
        mocks.sendEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
        await expect(dispatchITEmailRequestOutbox(
            buildChildOutbox("EMAIL_REQUEST_EMAIL"),
        )).rejects.toThrow("SMTP unavailable");
        expect(mocks.sendLine).not.toHaveBeenCalled();

        mocks.sendEmail.mockClear();
        mocks.sendLine.mockRejectedValueOnce(new Error("LINE unavailable"));
        await expect(dispatchITEmailRequestOutbox(
            buildChildOutbox("EMAIL_REQUEST_LINE"),
        )).rejects.toThrow("LINE unavailable");
        expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it("rejects malformed payloads, event identities, and other outbox types", async () => {
        await expect(dispatchITEmailRequestOutbox(
            buildOutbox("EMAIL_REQUEST", "{"),
        )).rejects.toThrow("Invalid EMAIL_REQUEST payload JSON");

        const mismatched = buildChildOutbox(
            "EMAIL_REQUEST_EMAIL",
            { ...buildChildPayload(), recipientUserId: 11 },
        );
        await expect(dispatchITEmailRequestOutbox({
            ...mismatched,
            eventKey: buildEmailRequestEmailEventKey(42, 900, 10),
        })).rejects.toThrow("EMAIL_REQUEST_EMAIL event identity mismatch");

        await expect(dispatchITEmailRequestOutbox(
            buildOutbox("LEAVE_ACTION", "{}"),
        )).resolves.toBeNull();
    });
});
