import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import type { PrismaClient } from "@prisma/client";
import {
    createTicket,
    updateTicket,
    deleteTicket,
} from "@/lib/services/ticket/mutations";

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
                }),
            );

            await createTicket(data, {
                id: 1,
                role: "USER",
                email: "user@test.com",
                requestId: "req-create",
            });

            expect(prismaMock.ticket.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        title: "T",
                        reportedById: 1,
                    }),
                }),
            );
            expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        type: "TICKET_CREATED",
                        payload: JSON.stringify({ ticketId: 1 }),
                    },
                }),
            );
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "TICKET_CREATE",
                        entityId: 1,
                        userId: 1,
                    }),
                }),
            );
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
            expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        type: "TICKET_UPDATED",
                        payload: JSON.stringify({
                            ticketId: 1,
                            oldStatus: "OPEN",
                        }),
                    },
                }),
            );
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

