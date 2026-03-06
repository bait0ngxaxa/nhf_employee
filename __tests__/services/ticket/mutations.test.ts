import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import {
    createTicket,
    updateTicket,
    deleteTicket,
} from "@/lib/services/ticket/mutations";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
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

            await createTicket(data, 1);

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
        });
    });

    describe("updateTicket", () => {
        const existingTicket = {
            id: 1,
            reportedById: 10,
            status: "OPEN",
            priority: "LOW",
        };

        it("should allow owner to update title if OPEN", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.update.mockResolvedValue(
                asNever({
                    ...existingTicket,
                    title: "New",
                }),
            );

            const user = { id: 10, role: "USER", email: "" };
            const result = await updateTicket(1, { title: "New" }, user);

            expect(result.ticket).toBeDefined();
            expect(prismaMock.ticket.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { title: "New" },
                }),
            );
        });

        it("should NOT allow owner to update status", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.update.mockResolvedValue(asNever(existingTicket));

            const user = { id: 10, role: "USER", email: "" };
            await updateTicket(1, { status: "RESOLVED" }, user);

            expect(prismaMock.ticket.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({ status: "RESOLVED" }),
                }),
            );
        });

        it("should allow admin to update status and enqueue outbox", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(
                asNever(existingTicket),
            );
            prismaMock.ticket.update.mockResolvedValue(
                asNever({
                    ...existingTicket,
                    status: "RESOLVED",
                }),
            );

            const user = { id: 99, role: "ADMIN", email: "" };
            await updateTicket(1, { status: "RESOLVED" }, user);

            expect(prismaMock.ticket.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: "RESOLVED" }),
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
        });
    });

    describe("deleteTicket", () => {
        it("should deny non-admin", async () => {
            const user = { id: 1, role: "USER", email: "" };
            const result = await deleteTicket(1, user);
            expect(result.success).toBe(false);
            expect(result.error).toContain("Unauthorized");
        });

        it("should allow admin", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(asNever({ id: 1 }));
            const user = { id: 99, role: "ADMIN", email: "" };
            const result = await deleteTicket(1, user);
            expect(result.success).toBe(true);
            expect(prismaMock.ticket.delete).toHaveBeenCalled();
        });
    });
});

