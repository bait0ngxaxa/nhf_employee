import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { getTickets, getTicketById } from "@/lib/services/ticket/queries";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Ticket Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("getTickets", () => {
        it("should return all tickets for ADMIN", async () => {
            const user = { id: 1, role: "ADMIN", email: "admin@test.com" };
            prismaMock.ticket.findMany.mockResolvedValue([{ id: 1 }] as any);
            prismaMock.ticket.count.mockResolvedValue(1);

            const result = await getTickets({ page: 1 }, user);

            expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({ reportedById: 1 }), // Should NOT restrict to user
                }),
            );
            expect(result.tickets).toHaveLength(1);
        });

        it("should return only own tickets for USER", async () => {
            const user = { id: 2, role: "USER", email: "user@test.com" };
            prismaMock.ticket.findMany.mockResolvedValue([{ id: 2 }] as any);
            prismaMock.ticket.count.mockResolvedValue(1);

            await getTickets({ page: 1 }, user);

            expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ reportedById: 2 }), // MUST restrict
                }),
            );
        });

        it("should apply filters", async () => {
            const user = { id: 1, role: "ADMIN", email: "" };
            prismaMock.ticket.findMany.mockResolvedValue([]);
            prismaMock.ticket.count.mockResolvedValue(0);

            await getTickets(
                { page: 1, status: "OPEN", priority: "HIGH" },
                user,
            );

            expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: "OPEN",
                        priority: "HIGH",
                    }),
                }),
            );
        });
    });

    describe("getTicketById", () => {
        const mockTicket = { id: 1, reportedById: 2, title: "Test" };

        it("should deny access if user is not owner and not admin", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(mockTicket as any);
            const user = { id: 3, role: "USER", email: "" }; // Not 2 (owner)

            const result = await getTicketById(1, user);

            expect(result.ticket).toBeNull();
            expect(result.error).toBe("Access denied");
        });

        it("should allow access if user is owner", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(mockTicket as any);
            const user = { id: 2, role: "USER", email: "" };

            const result = await getTicketById(1, user);

            expect(result.ticket).toEqual(mockTicket);
        });

        it("should allow access if user is admin", async () => {
            prismaMock.ticket.findUnique.mockResolvedValue(mockTicket as any);
            const user = { id: 99, role: "ADMIN", email: "" };

            const result = await getTicketById(1, user);

            expect(result.ticket).toEqual(mockTicket);
        });
    });
});
