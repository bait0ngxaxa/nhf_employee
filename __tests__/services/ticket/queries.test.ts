import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import {
    getTickets,
    getTicketById,
    getTicketStats,
} from "@/lib/services/ticket/queries";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;
const ticketGroupByMock = prismaMock.ticket.groupBy as unknown as ReturnType<
    typeof vi.fn
>;

describe("Ticket Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("getTickets", () => {
        it("should return all tickets for ADMIN", async () => {
            const user = { id: 1, role: "ADMIN", email: "admin@test.com" };
            prismaMock.ticket.findMany.mockResolvedValue([{ id: 1 }] as never);
            prismaMock.ticket.count.mockResolvedValue(1);

            const result = await getTickets({ page: 1, limit: 10 }, user);

            expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({ reportedById: 1 }), // Should NOT restrict to user
                }),
            );
            expect(result.tickets).toHaveLength(1);
        });

        it("should return only own tickets for USER", async () => {
            const user = { id: 2, role: "USER", email: "user@test.com" };
            prismaMock.ticket.findMany.mockResolvedValue([{ id: 2 }] as never);
            prismaMock.ticket.count.mockResolvedValue(1);

            await getTickets({ page: 1, limit: 10 }, user);

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
                { page: 1, limit: 10, status: "OPEN", priority: "HIGH" },
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

        it("should use MySQL-compatible search filters", async () => {
            const user = { id: 1, role: "ADMIN", email: "" };
            prismaMock.ticket.findMany.mockResolvedValue([]);
            prismaMock.ticket.count.mockResolvedValue(0);

            await getTickets(
                { page: 1, limit: 10, search: " printer " },
                user,
            );

            const expectedWhere = {
                deletedAt: null,
                OR: [
                    { title: { contains: "printer" } },
                    { description: { contains: "printer" } },
                ],
            };
            expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expectedWhere }),
            );
            expect(prismaMock.ticket.count).toHaveBeenCalledWith({
                where: expectedWhere,
            });
        });
    });

    describe("getTicketById", () => {
        const mockTicket = { id: 1, reportedById: 2, title: "Test" };

        it("should deny access if user is not owner and not admin", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(mockTicket as never);
            const user = { id: 3, role: "USER", email: "" }; // Not 2 (owner)

            const result = await getTicketById(1, user);

            expect(result.ticket).toBeNull();
            expect(result.error).toBe("Access denied");
        });

        it("should allow access if user is owner", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(mockTicket as never);
            const user = { id: 2, role: "USER", email: "" };

            const result = await getTicketById(1, user);

            expect(result.ticket).toEqual(mockTicket);
        });

        it("should allow access if user is admin", async () => {
            prismaMock.ticket.findFirst.mockResolvedValue(mockTicket as never);
            const user = { id: 99, role: "ADMIN", email: "" };

            const result = await getTicketById(1, user);

            expect(result.ticket).toEqual(mockTicket);
        });
    });

    describe("getTicketStats", () => {
        it("aggregates all accessible tickets for an admin", async () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-07-25T12:00:00.000Z"));
            prismaMock.ticket.count
                .mockResolvedValueOnce(250)
                .mockResolvedValueOnce(18)
                .mockResolvedValueOnce(12);
            ticketGroupByMock
                .mockResolvedValueOnce([
                    { status: "OPEN", _count: { _all: 120 } },
                    { status: "IN_PROGRESS", _count: { _all: 60 } },
                    { status: "RESOLVED", _count: { _all: 50 } },
                    { status: "CLOSED", _count: { _all: 20 } },
                ] as never)
                .mockResolvedValueOnce([
                    { priority: "HIGH", _count: { _all: 45 } },
                    { priority: "URGENT", _count: { _all: 9 } },
                ] as never);

            const result = await getTicketStats({
                id: 7,
                role: "ADMIN",
                email: "admin@test.com",
            });

            expect(result).toEqual({
                total: 250,
                open: 120,
                inProgress: 60,
                resolved: 50,
                closed: 20,
                cancelled: 0,
                highPriority: 45,
                urgentPriority: 9,
                userTickets: 18,
                newTickets: 12,
            });
            expect(ticketGroupByMock).toHaveBeenNthCalledWith(1, {
                by: ["status"],
                where: { deletedAt: null },
                _count: { _all: true },
            });
            expect(prismaMock.ticket.count).toHaveBeenNthCalledWith(2, {
                where: { deletedAt: null, assignedToId: 7 },
            });
            expect(prismaMock.ticket.count).toHaveBeenNthCalledWith(3, {
                where: {
                    deletedAt: null,
                    createdAt: { gte: new Date("2026-07-24T12:00:00.000Z") },
                    views: { none: { userId: 7 } },
                },
            });
            vi.useRealTimers();
        });

        it("restricts every aggregate to a non-admin reporter", async () => {
            prismaMock.ticket.count.mockResolvedValue(0);
            ticketGroupByMock.mockResolvedValue([]);

            await getTicketStats({
                id: 22,
                role: "USER",
                email: "user@test.com",
            });

            expect(ticketGroupByMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { deletedAt: null, reportedById: 22 },
                }),
            );
            expect(prismaMock.ticket.count).toHaveBeenNthCalledWith(1, {
                where: { deletedAt: null, reportedById: 22 },
            });
            expect(prismaMock.ticket.count).toHaveBeenNthCalledWith(2, {
                where: { deletedAt: null, reportedById: 22 },
            });
            expect(prismaMock.ticket.count).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({
                    where: expect.objectContaining({ reportedById: 22 }),
                }),
            );
        });
    });
});
