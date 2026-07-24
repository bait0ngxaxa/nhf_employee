import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { createTicketComment } from "@/lib/services/ticket/comments";
import { TicketIdempotencyConflictError } from "@/lib/services/ticket/idempotency";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

const actor = {
    id: 1,
    role: "ADMIN" as const,
    email: "admin@test.com",
};

const comment = {
    id: 3001,
    content: "กำลังตรวจสอบ",
    ticketId: 55,
    authorId: 1,
    author: {
        id: 1,
        name: "Admin",
        email: "admin@test.com",
        role: "ADMIN",
        employee: null,
    },
};

describe("createTicketComment", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$transaction.mockImplementation(async (callback) =>
            callback(prismaMock as unknown as PrismaClient));
        prismaMock.ticket.findFirst.mockResolvedValue(asNever({
            id: 55,
            title: "VPN issue",
            reportedById: 9,
            assignedToId: null,
        }));
        prismaMock.ticketComment.create.mockResolvedValue(asNever(comment));
    });

    it("creates comment and idempotency record in one transaction", async () => {
        const result = await createTicketComment(
            55,
            { content: "กำลังตรวจสอบ" },
            actor,
            { idempotencyKey: "comment-3001" },
        );

        expect(result).toMatchObject({
            outcome: "created",
            replayed: false,
            comment: { id: 3001 },
        });
        expect(prismaMock.ticketMutationIdempotency.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 1,
                idempotencyKey: "comment-3001",
                operation: "TICKET_COMMENT",
                resourceId: 3001,
            }),
        });
    });

    it("replays an existing comment without creating side effects", async () => {
        prismaMock.ticketMutationIdempotency.findUnique.mockResolvedValue(
            asNever({
                userId: 1,
                idempotencyKey: "comment-3001",
                operation: "TICKET_COMMENT",
                requestHash:
                    "5593b4251e9e42cf69e3445d6b42074e70f59c6d8468841bf550235589b4ba91",
                resourceId: 3001,
            }),
        );
        prismaMock.ticketComment.findUnique.mockResolvedValue(asNever(comment));

        const result = await createTicketComment(
            55,
            { content: "กำลังตรวจสอบ" },
            actor,
            { idempotencyKey: "comment-3001" },
        );

        expect(result).toMatchObject({
            outcome: "created",
            replayed: true,
            comment: { id: 3001 },
        });
        expect(prismaMock.ticketComment.create).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects a reused key with a different comment", async () => {
        prismaMock.ticketMutationIdempotency.findUnique.mockResolvedValue(
            asNever({
                userId: 1,
                idempotencyKey: "comment-3001",
                operation: "TICKET_COMMENT",
                requestHash: "different",
                resourceId: 3001,
            }),
        );

        await expect(createTicketComment(
            55,
            { content: "ข้อความใหม่" },
            actor,
            { idempotencyKey: "comment-3001" },
        )).rejects.toBeInstanceOf(TicketIdempotencyConflictError);
    });

    it("replays the winning comment after a concurrent key collision", async () => {
        prismaMock.ticketMutationIdempotency.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(asNever({
                userId: 1,
                idempotencyKey: "comment-race",
                operation: "TICKET_COMMENT",
                requestHash:
                    "5593b4251e9e42cf69e3445d6b42074e70f59c6d8468841bf550235589b4ba91",
                resourceId: 3001,
            }));
        prismaMock.ticketMutationIdempotency.create.mockRejectedValue({
            code: "P2002",
        });
        prismaMock.ticketComment.findUnique.mockResolvedValue(asNever(comment));

        const result = await createTicketComment(
            55,
            { content: "กำลังตรวจสอบ" },
            actor,
            { idempotencyKey: "comment-race" },
        );

        expect(result).toMatchObject({
            outcome: "created",
            replayed: true,
            comment: { id: 3001 },
        });
    });
});
