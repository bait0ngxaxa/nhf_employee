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

describe("Ticket Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("createTicket", () => {
        it("should create ticket", async () => {
            const data = {
                title: "T",
                description: "D",
                category: "C",
                priority: "LOW",
            };
            prismaMock.ticket.create.mockResolvedValue({
                id: 1,
                ...data,
            } as any);

            await createTicket(data, 1);

            expect(prismaMock.ticket.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        title: "T",
                        reportedById: 1,
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
        };

        it("should allow owner to update title if OPEN", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(
                existingTicket as any,
            );
            prismaMock.ticket.update.mockResolvedValue({
                ...existingTicket,
                title: "New",
            } as any);

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
                existingTicket as any,
            );
            prismaMock.ticket.update.mockResolvedValue(existingTicket as any);

            const user = { id: 10, role: "USER", email: "" };
            await updateTicket(1, { status: "RESOLVED" }, user);

            // updateFields should NOT contain status
            expect(prismaMock.ticket.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({ status: "RESOLVED" }),
                }),
            );
        });

        it("should allow admin to update status", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(
                existingTicket as any,
            );
            prismaMock.ticket.update.mockResolvedValue({
                ...existingTicket,
                status: "RESOLVED",
            } as any);

            const user = { id: 99, role: "ADMIN", email: "" };
            await updateTicket(1, { status: "RESOLVED" }, user);

            expect(prismaMock.ticket.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: "RESOLVED" }),
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
            prismaMock.ticket.findUnique.mockResolvedValue({ id: 1 } as any);
            const user = { id: 99, role: "ADMIN", email: "" };
            const result = await deleteTicket(1, user);
            expect(result.success).toBe(true);
            expect(prismaMock.ticket.delete).toHaveBeenCalled();
        });
    });
});
