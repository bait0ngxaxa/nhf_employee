import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import type { PrismaClient } from "@prisma/client";
import {
    createTicket,
    updateTicket,
    deleteTicket,
} from "@/lib/services/ticket/mutations";
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

describe("Ticket Mutations", () => {
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

    describe("createTicket", () => {
        it("should create ticket and enqueue outbox", async () => {
            const data = {
                title: "T",
                description: "D",
                category: "HARDWARE" as const,
                priority: "LOW" as const,
            };

            prismaMock.ticket.create.mockResolvedValue(
                asNever({
                    id: 1,
                    ...data,
                    reportedById: 1,
                }),
            );

            await createTicket(data, {
                id: 1,
                role: "USER",
                email: "user@test.com",
                requestId: "req-create",
            }, { idempotencyKey: "ticket-create-1" });

            expect(prismaMock.ticket.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        title: "T",
                        reportedById: 1,
                    }),
                }),
            );
            expect(prismaMock.notificationOutbox.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        type: "TICKET_CREATED_IN_APP",
                        payload: JSON.stringify({ ticketId: 1 }),
                        eventKey: "ticket:1:created:in-app:admins",
                    },
                    {
                        type: "TICKET_CREATED_LINE",
                        payload: JSON.stringify({ ticketId: 1 }),
                        eventKey: "ticket:1:created:line:it",
                    },
                    {
                        type: "TICKET_CREATED_EMAIL_REPORTER",
                        payload: JSON.stringify({ ticketId: 1 }),
                        eventKey: "ticket:1:created:email:reporter:1",
                    },
                ],
                skipDuplicates: true,
            });
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "TICKET_CREATE",
                        entityId: 1,
                        userId: 1,
                    }),
                }),
            );
            expect(
                prismaMock.ticketMutationIdempotency.create,
            ).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 1,
                    idempotencyKey: "ticket-create-1",
                    operation: "TICKET_CREATE",
                    resourceId: 1,
                }),
            });
        });

        it("replays an existing ticket without duplicate side effects", async () => {
            prismaMock.ticketMutationIdempotency.findUnique.mockResolvedValue(
                asNever({
                    userId: 1,
                    idempotencyKey: "ticket-create-1",
                    operation: "TICKET_CREATE",
                    requestHash:
                        "cbec02636d3a8ad889a77e09bf77ac52d2216449065270ad78ea9c1fc2091fb1",
                    resourceId: 1,
                }),
            );
            prismaMock.ticket.findUnique.mockResolvedValue(asNever({ id: 1 }));

            const result = await createTicket({
                title: "T",
                description: "D",
                category: "HARDWARE",
                priority: "LOW",
            }, {
                id: 1,
                role: "USER",
                email: "user@test.com",
            }, { idempotencyKey: "ticket-create-1" });

            expect(result).toMatchObject({
                replayed: true,
                ticket: { id: 1 },
            });
            expect(prismaMock.ticket.create).not.toHaveBeenCalled();
            expect(prismaMock.notificationOutbox.createMany).not.toHaveBeenCalled();
        });

        it("rejects a reused key with a different ticket payload", async () => {
            prismaMock.ticketMutationIdempotency.findUnique.mockResolvedValue(
                asNever({
                    userId: 1,
                    idempotencyKey: "ticket-create-1",
                    operation: "TICKET_CREATE",
                    requestHash: "different",
                    resourceId: 1,
                }),
            );

            await expect(createTicket({
                title: "Different",
                description: "D",
                category: "HARDWARE",
                priority: "LOW",
            }, {
                id: 1,
                role: "USER",
                email: "user@test.com",
            }, { idempotencyKey: "ticket-create-1" })).rejects.toBeInstanceOf(
                TicketIdempotencyConflictError,
            );
        });

        it("replays the winner when concurrent creates hit the unique key", async () => {
            const record = {
                userId: 1,
                idempotencyKey: "ticket-create-race",
                operation: "TICKET_CREATE",
                requestHash:
                    "cbec02636d3a8ad889a77e09bf77ac52d2216449065270ad78ea9c1fc2091fb1",
                resourceId: 99,
            };
            prismaMock.ticketMutationIdempotency.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(asNever(record));
            prismaMock.ticket.create.mockResolvedValue(asNever({
                id: 100,
                title: "T",
                description: "D",
                category: "HARDWARE",
                priority: "LOW",
                reportedById: 1,
            }));
            prismaMock.ticketMutationIdempotency.create.mockRejectedValue(
                { code: "P2002" },
            );
            prismaMock.ticket.findUnique.mockResolvedValue(asNever({ id: 99 }));

            const result = await createTicket({
                title: "T",
                description: "D",
                category: "HARDWARE",
                priority: "LOW",
            }, {
                id: 1,
                role: "USER",
                email: "user@test.com",
            }, { idempotencyKey: "ticket-create-race" });

            expect(result).toMatchObject({
                replayed: true,
                ticket: { id: 99 },
            });
        });

        it("enqueues urgent IT email as a separate destination", async () => {
            const data = {
                title: "Server down",
                description: "Production is unavailable",
                category: "NETWORK" as const,
                priority: "URGENT" as const,
            };
            prismaMock.ticket.create.mockResolvedValue(asNever({
                id: 2,
                ...data,
                reportedById: 7,
            }));

            await createTicket(data, {
                id: 7,
                role: "ADMIN",
                email: "reporter@test.com",
            }, { idempotencyKey: "ticket-create-2" });

            expect(prismaMock.notificationOutbox.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.arrayContaining([
                        {
                            type: "TICKET_CREATED_EMAIL_IT",
                            payload: JSON.stringify({ ticketId: 2 }),
                            eventKey: "ticket:2:created:email:it",
                        },
                    ]),
                }),
            );
        });

        it("rejects URGENT priority from a non-admin caller", async () => {
            await expect(createTicket({
                title: "Server down",
                description: "Production is unavailable",
                category: "NETWORK",
                priority: "URGENT",
            }, {
                id: 7,
                role: "USER",
                email: "reporter@test.com",
            }, {
                idempotencyKey: "ticket-create-urgent-user",
            })).rejects.toThrow(
                "เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดระดับเร่งด่วนได้",
            );

            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });
    });

    describe("updateTicket", () => {
        const existingTicket = {
            id: 1,
            reportedById: 10,
            status: "OPEN",
            priority: "LOW",
            resolvedAt: null,
            closedAt: null,
            cancelledAt: null,
            updatedAt: new Date("2026-07-24T01:00:00.000Z"),
        };

        it("should allow owner to update title if OPEN", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.ticket.findFirstOrThrow.mockResolvedValue(
                asNever({
                    ...existingTicket,
                    title: "New",
                }),
            );

            const user = { id: 10, role: "USER", email: "" };
            const result = await updateTicket(1, { title: "New" }, user);

            expect(result.ticket).toBeDefined();
            expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { title: "New" },
                    where: {
                        id: 1,
                        status: "OPEN",
                        updatedAt: existingTicket.updatedAt,
                        deletedAt: null,
                    },
                }),
            );
        });

        it("should NOT allow owner to update status", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.ticket.findFirstOrThrow.mockResolvedValue(
                asNever(existingTicket),
            );

            const user = { id: 10, role: "USER", email: "" };
            await updateTicket(1, { status: "RESOLVED" }, user);

            expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({ status: "RESOLVED" }),
                }),
            );
        });

        it("should allow admin to update status and enqueue outbox", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
            prismaMock.ticket.findFirstOrThrow.mockResolvedValue(
                asNever({
                    ...existingTicket,
                    status: "RESOLVED",
                }),
            );

            const user = { id: 99, role: "ADMIN", email: "" };
            await updateTicket(1, { status: "RESOLVED" }, user);

            expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: "RESOLVED",
                        resolvedAt: expect.any(Date),
                    }),
                }),
            );
            expect(prismaMock.notificationOutbox.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        type: "TICKET_UPDATED_IN_APP_REPORTER",
                        payload: JSON.stringify({
                            ticketId: 1,
                            oldStatus: "OPEN",
                        }),
                        eventKey: expect.stringMatching(
                            /^ticket:1:status:.+:in-app:reporter:10$/,
                        ),
                    },
                    {
                        type: "TICKET_UPDATED_EMAIL_REPORTER",
                        payload: JSON.stringify({
                            ticketId: 1,
                            oldStatus: "OPEN",
                        }),
                        eventKey: expect.stringMatching(
                            /^ticket:1:status:.+:email:reporter:10$/,
                        ),
                    },
                    {
                        type: "TICKET_UPDATED_LINE",
                        payload: JSON.stringify({
                            ticketId: 1,
                            oldStatus: "OPEN",
                        }),
                        eventKey: expect.stringMatching(
                            /^ticket:1:status:.+:line:it$/,
                        ),
                    },
                ],
                skipDuplicates: true,
            });
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "TICKET_STATUS_CHANGE",
                        entityId: 1,
                        userId: 99,
                    }),
                }),
            );
        });

        it("should return 409 when optimistic lock detects a concurrent update", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.updateMany.mockResolvedValue({ count: 0 });

            const user = { id: 99, role: "ADMIN", email: "" };
            const result = await updateTicket(
                1,
                { status: "IN_PROGRESS" },
                user,
            );

            expect(result).toEqual({
                ticket: null,
                error: "Ticket was updated by another user",
                status: 409,
            });
            expect(
                prismaMock.notificationOutbox.create,
            ).not.toHaveBeenCalled();
            expect(
                prismaMock.ticket.findFirstOrThrow,
            ).not.toHaveBeenCalled();
        });

        it("should reject an invalid status transition with 409", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(
                asNever({
                    ...existingTicket,
                    status: "CLOSED",
                    resolvedAt: new Date("2026-07-23T01:00:00.000Z"),
                    closedAt: new Date("2026-07-23T02:00:00.000Z"),
                }),
            );

            const user = { id: 99, role: "ADMIN", email: "" };
            const result = await updateTicket(
                1,
                { status: "RESOLVED" },
                user,
            );

            expect(result).toEqual({
                ticket: null,
                error: "Invalid ticket status transition",
                status: 409,
            });
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });
    });

    describe("deleteTicket", () => {
        it("should deny non-admin", async () => {
            const user = { id: 1, role: "USER", email: "" };
            const result = await deleteTicket(1, "ข้อมูลทดสอบ", user);
            expect(result.success).toBe(false);
            expect(result.error).toContain("Unauthorized");
        });

        it("should allow admin", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(
                asNever({
                    id: 1,
                    title: "T",
                    description: "D",
                    category: "HARDWARE",
                    priority: "LOW",
                    status: "OPEN",
                    assignedToId: null,
                    deletedAt: null,
                    updatedAt: new Date("2026-07-24T01:00:00.000Z"),
                }),
            );
            prismaMock.ticket.updateMany.mockResolvedValue({ count: 1 });
            const user = { id: 99, role: "ADMIN", email: "" };
            const result = await deleteTicket(1, "ลบข้อมูลทดสอบ", user);
            expect(result.success).toBe(true);
            expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        deletedAt: expect.any(Date),
                        deletedById: 99,
                        deleteReason: "ลบข้อมูลทดสอบ",
                    }),
                }),
            );
            expect(prismaMock.ticket.delete).not.toHaveBeenCalled();
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "TICKET_DELETE",
                        entityId: 1,
                        userId: 99,
                    }),
                }),
            );
        });
    });
});

