import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailRequestData } from "../../domain/email-request/contracts";

const mocks = vi.hoisted(() => ({
    findRecipients: vi.fn(),
    createInbox: vi.fn(),
    createMany: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("@/modules/authorization", () => ({
    findActiveUsersWithConfiguredCapabilityScope: mocks.findRecipients,
}));
vi.mock("@/modules/notification", () => ({ createForUserOnce: mocks.createInbox }));
vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: mocks.transaction,
}));

import {
    buildEmailRequestEmailEventKey,
    buildEmailRequestLineEventKey,
    enqueueEmailRequestNotificationChannels,
} from "./notifications";

const payload: EmailRequestData = {
    emailRequestId: 77,
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

type EmailRequestCreateManyInput = {
    readonly data: Prisma.NotificationOutboxCreateManyInput[];
    readonly skipDuplicates?: boolean;
};

function getCreateManyCalls(): Array<[EmailRequestCreateManyInput]> {
    return mocks.createMany.mock.calls as unknown as Array<[
        EmailRequestCreateManyInput,
    ]>;
}

describe("Email Request channel fan-out", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const tx = {
            notificationOutbox: { createMany: mocks.createMany },
        } as unknown as Prisma.TransactionClient;
        mocks.transaction.mockImplementation(async (
            operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) => operation(tx));
        mocks.findRecipients.mockResolvedValue([10, 11]);
        mocks.createInbox.mockResolvedValue(undefined);
        mocks.createMany.mockResolvedValue({ count: 4 });
    });

    it("uses only configured email.request.read / ALL recipients for all three channels", async () => {
        await enqueueEmailRequestNotificationChannels(77, 900, payload);

        expect(mocks.findRecipients).toHaveBeenCalledWith({
            capability: "email.request.read",
            scope: "ALL",
        }, expect.anything());
        expect(mocks.createInbox).toHaveBeenCalledTimes(2);
        expect(mocks.createInbox.mock.calls.map(([input]) => input.userId))
            .toEqual([10, 11]);
        expect(mocks.createInbox).toHaveBeenCalledWith(expect.objectContaining({
            type: "SYSTEM_ALERT",
            actionUrl: "/dashboard/email-request",
            referenceId: "somchai@example.com",
            dedupeKey: "email-request:somchai@example.com:2026-09-20T03:00:00.000Z:10",
        }), expect.anything());

        const createManyInput = getCreateManyCalls()[0]?.[0];
        expect(createManyInput).toBeDefined();
        if (!createManyInput) return;
        expect(createManyInput.data).toHaveLength(4);
        expect(createManyInput.skipDuplicates).toBe(true);
        expect(createManyInput.data.map(({ type }) => type)).toEqual([
            "EMAIL_REQUEST_EMAIL",
            "EMAIL_REQUEST_LINE",
            "EMAIL_REQUEST_EMAIL",
            "EMAIL_REQUEST_LINE",
        ]);
        expect(createManyInput.data.map(({ eventKey }) => eventKey)).toEqual([
            buildEmailRequestEmailEventKey(77, 900, 10),
            buildEmailRequestLineEventKey(77, 900, 10),
            buildEmailRequestEmailEventKey(77, 900, 11),
            buildEmailRequestLineEventKey(77, 900, 11),
        ]);
        const parsedChildren = createManyInput.data.map(({ payload: rowPayload }) =>
            JSON.parse(rowPayload) as Record<string, unknown>,
        );
        expect(parsedChildren.map(({ recipientUserId }) => recipientUserId))
            .toEqual([10, 10, 11, 11]);
        for (const row of createManyInput.data) {
            expect(row.payload).not.toContain("replyEmail");
            expect(row.payload).not.toContain("Somchai");
        }
    });

    it("keeps fan-out idempotent when the parent is retried", async () => {
        await enqueueEmailRequestNotificationChannels(77, 900, payload);
        const firstRows = getCreateManyCalls()[0]?.[0].data;
        await enqueueEmailRequestNotificationChannels(77, 900, payload);
        const secondRows = getCreateManyCalls()[1]?.[0].data;

        expect(mocks.createInbox).toHaveBeenCalledTimes(4);
        expect(secondRows?.map(({ eventKey }) => eventKey))
            .toEqual(firstRows?.map(({ eventKey }) => eventKey));
    });

    it("accepts an empty configured audience without creating any channel rows", async () => {
        mocks.findRecipients.mockResolvedValueOnce([]);

        await expect(enqueueEmailRequestNotificationChannels(77, 900, payload))
            .resolves.toBeUndefined();

        expect(mocks.createInbox).not.toHaveBeenCalled();
        expect(mocks.createMany).not.toHaveBeenCalled();
    });

    it("uses parent outbox identity only for historical rows missing a request id", async () => {
        await enqueueEmailRequestNotificationChannels(null, 901, {
            ...payload,
            emailRequestId: undefined,
        });

        const rows = getCreateManyCalls()[0]?.[0].data;
        expect(rows?.[0]?.eventKey).toBe(
            "email-request:outbox:901:user:10:email",
        );
        expect(rows?.[0]?.payload).toContain('"emailRequestId":null');
    });

    it("uses access-version identities for update retries and permits later notifications without PII", async () => {
        const update = { version: 1 as const, emailRequestId: 77, accessVersion: 2 };
        await enqueueEmailRequestNotificationChannels(77, 901, update);
        await enqueueEmailRequestNotificationChannels(77, 901, update);
        await enqueueEmailRequestNotificationChannels(77, 902, { ...update, accessVersion: 3 });
        const calls = getCreateManyCalls();
        expect(calls[0]?.[0].data.map((row) => row.eventKey)).toEqual(calls[1]?.[0].data.map((row) => row.eventKey));
        expect(calls[2]?.[0].data[0]?.eventKey).toBe("email-request:77:access:3:user:10:email");
        expect(mocks.createInbox).toHaveBeenCalledWith(expect.objectContaining({
            title: "มีการอัปเดตสิทธิ์พนักงานใหม่", message: "คำร้อง #77 มีการระบุหรือแก้ไขสิทธิ์การใช้งานเพิ่มเติม",
            dedupeKey: "email-request:77:access:2:user:10",
        }), expect.anything());
        expect(mocks.findRecipients).toHaveBeenCalledWith({ capability: "email.request.read", scope: "ALL" }, expect.anything());
        expect(JSON.stringify(calls)).not.toContain(payload.phone);
        expect(JSON.stringify(mocks.createInbox.mock.calls)).not.toContain(payload.phone);
    });
});
