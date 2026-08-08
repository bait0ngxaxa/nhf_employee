import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    createEmailRequest,
} from "@/lib/services/email-request/mutations";
import {
    createEmailRequestHash,
    EmailRequestIdempotencyConflictError,
} from "@/lib/services/email-request/idempotency";
import type { CreateEmailRequestData } from "@/lib/services/email-request/types";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

const DATA: CreateEmailRequestData = {
    thaiName: "สมชาย ใจดี",
    englishName: "Somchai Jaidee",
    phone: "081-2345678",
    department: "มสช.",
    position: "เจ้าหน้าที่",
    replyEmail: "somchai@example.com",
    nickname: "ชาย",
    needsDocumentSystem: true,
    sharedDriveAccess: ["account", "it"],
};
const USER = { id: 1, role: "ADMIN", email: "admin@thainhf.org" };
const EXISTING_REQUEST = {
    id: 10,
    ...DATA,
    requestedBy: USER.id,
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
};

describe("Email Request Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$transaction.mockImplementation(async (arg) => {
            if (Array.isArray(arg)) {
                return Promise.all(arg);
            }

            const callback = arg as (client: PrismaClient) => unknown;
            return callback(prismaMock as unknown as PrismaClient);
        });
    });

    it("creates one request, one idempotency record, and one outbox event", async () => {
        prismaMock.emailRequestIdempotency.findUnique.mockResolvedValue(null);
        prismaMock.emailRequest.create.mockResolvedValue(EXISTING_REQUEST as never);
        prismaMock.emailRequestIdempotency.create.mockResolvedValue({ id: "idem-1" } as never);
        prismaMock.notificationOutbox.create.mockResolvedValue({ id: 1 } as never);

        const result = await createEmailRequest(DATA, USER, {
            idempotencyKey: "email-request-key",
        });

        expect(result).toMatchObject({
            success: true,
            replayed: false,
            emailRequest: { id: EXISTING_REQUEST.id },
        });
        expect(prismaMock.emailRequest.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.emailRequestIdempotency.create).toHaveBeenCalledWith({
            data: {
                userId: USER.id,
                idempotencyKey: "email-request-key",
                requestHash: createEmailRequestHash(DATA),
                emailRequestId: EXISTING_REQUEST.id,
            },
        });
        expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "EMAIL_REQUEST",
                eventKey: `email-request:${EXISTING_REQUEST.id}:created`,
            }),
        });
    });

    it("replays the existing request for the same key and canonical payload", async () => {
        const reorderedData = {
            ...DATA,
            sharedDriveAccess: ["it", "account"] as CreateEmailRequestData["sharedDriveAccess"],
        };
        prismaMock.emailRequestIdempotency.findUnique.mockResolvedValue({
            requestHash: createEmailRequestHash(DATA),
            emailRequest: EXISTING_REQUEST,
        } as never);

        const result = await createEmailRequest(reorderedData, USER, {
            idempotencyKey: "email-request-key",
        });

        expect(result).toMatchObject({
            success: true,
            replayed: true,
            emailRequest: { id: EXISTING_REQUEST.id },
        });
        expect(prismaMock.emailRequest.create).not.toHaveBeenCalled();
        expect(prismaMock.emailRequestIdempotency.create).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });

    it("rejects the same key when the validated business payload differs", async () => {
        prismaMock.emailRequestIdempotency.findUnique.mockResolvedValue({
            requestHash: createEmailRequestHash(DATA),
            emailRequest: EXISTING_REQUEST,
        } as never);

        await expect(createEmailRequest(
            { ...DATA, position: "ผู้จัดการ" },
            USER,
            { idempotencyKey: "email-request-key" },
        )).rejects.toBeInstanceOf(EmailRequestIdempotencyConflictError);

        expect(prismaMock.emailRequest.create).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });

    it("re-reads and replays after the concurrent idempotency unique race", async () => {
        prismaMock.emailRequestIdempotency.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                requestHash: createEmailRequestHash(DATA),
                emailRequest: EXISTING_REQUEST,
            } as never);
        prismaMock.emailRequest.create.mockResolvedValue({
            ...EXISTING_REQUEST,
            id: 11,
        } as never);
        prismaMock.emailRequestIdempotency.create.mockRejectedValue({
            code: "P2002",
        });

        const result = await createEmailRequest(DATA, USER, {
            idempotencyKey: "email-request-key",
        });

        expect(result).toMatchObject({
            success: true,
            replayed: true,
            emailRequest: { id: EXISTING_REQUEST.id },
        });
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });
});
