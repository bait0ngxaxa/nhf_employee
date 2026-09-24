import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthorizationModule from "./authorization";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    authorize: vi.fn(),
    assertWorkforce: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: { $transaction: mocks.transaction },
}));

vi.mock("./authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        resolveITCapabilityInTransaction: mocks.authorize,
    };
});

vi.mock("./workforce", () => ({
    assertITActorCurrentWorkforce: mocks.assertWorkforce,
}));

import {
    getITRequesterTicket,
    listITRequesterTickets,
} from "./ticket-queries";
import { ITTicketInputValidationError, ITTicketNotFoundError } from "./ticket-errors";
import { buildITAuthorizationContext } from "./authorization";

const tx = {
    iTTicket: {
        count: mocks.count,
        findMany: mocks.findMany,
        findFirst: mocks.findFirst,
    },
};

const actorContext = buildITAuthorizationContext({ id: 41, role: "USER" }, 84);
const createdAt = new Date("2026-09-01T01:00:00.000Z");
const updatedAt = new Date("2026-09-02T02:00:00.000Z");
const ticket = {
    id: 19,
    type: "INCIDENT" as const,
    title: "เข้าใช้งานระบบไม่ได้",
    description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
    status: "IN_PROGRESS" as const,
    createdAt,
    updatedAt,
    resolvedAt: null,
};

describe("IT requester Ticket queries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) =>
            callback(tx));
        mocks.authorize.mockResolvedValue({ scopes: ["OWN"] });
        mocks.assertWorkforce.mockResolvedValue({ employeeId: 84 });
        mocks.count.mockResolvedValue(11);
        mocks.findMany.mockResolvedValue([ticket]);
        mocks.findFirst.mockResolvedValue(ticket);
    });

    it("queries only the authenticated requester's rows with stable bounded pagination", async () => {
        const result = await listITRequesterTickets(actorContext, {
            page: "2",
            limit: "5",
        });

        expect(mocks.count).toHaveBeenCalledWith({ where: { requesterUserId: 41 } });
        expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { requesterUserId: 41 },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: 5,
            take: 5,
            select: expect.objectContaining({
                id: true,
                type: true,
                title: true,
                description: true,
                status: true,
                resolvedAt: true,
            }),
        }));
        expect(result).toEqual({
            tickets: [{
                id: 19,
                type: "INCIDENT",
                title: "เข้าใช้งานระบบไม่ได้",
                description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
                status: "IN_PROGRESS",
                createdAt: createdAt.toISOString(),
                updatedAt: updatedAt.toISOString(),
                resolvedAt: null,
            }],
            pagination: { page: 2, limit: 5, total: 11, totalPages: 3 },
        });
        expect(result.tickets[0]).not.toHaveProperty("requesterUserId");
        expect(result.tickets[0]).not.toHaveProperty("assignedToUserId");
        expect(result.tickets[0]).not.toHaveProperty("version");
    });

    it("treats an effective ALL grant as read access but keeps the SQL query requester-scoped", async () => {
        mocks.authorize.mockResolvedValue({ scopes: ["ALL"] });

        await listITRequesterTickets(actorContext, {});

        expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { requesterUserId: 41 },
        }));
    });

    it("does not query Tickets for pages beyond the current result set", async () => {
        const result = await listITRequesterTickets(actorContext, {
            page: 4,
            limit: 5,
        });

        expect(result).toMatchObject({
            tickets: [],
            pagination: { page: 4, limit: 5, total: 11, totalPages: 3 },
        });
        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    it("looks up details with both id and requester id in the database predicate", async () => {
        await getITRequesterTicket(actorContext, 19);

        expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 19, requesterUserId: 41 },
            select: expect.objectContaining({ id: true, description: true }),
        }));
    });

    it("returns the same not-found error for a foreign or absent Ticket", async () => {
        mocks.findFirst.mockResolvedValue(null);

        await expect(getITRequesterTicket(actorContext, 20))
            .rejects.toBeInstanceOf(ITTicketNotFoundError);
    });

    it("fails closed when workforce or read authorization is denied", async () => {
        mocks.assertWorkforce.mockRejectedValueOnce(new Error("inactive"));
        await expect(listITRequesterTickets(actorContext, {})).rejects.toThrow("inactive");
        expect(mocks.authorize).not.toHaveBeenCalled();

        mocks.assertWorkforce.mockResolvedValue({ employeeId: 84 });
        mocks.authorize.mockRejectedValueOnce(new Error("denied"));
        await expect(getITRequesterTicket(actorContext, 19)).rejects.toThrow("denied");
        expect(mocks.findFirst).not.toHaveBeenCalled();
    });

    it("rejects malformed identifiers and pagination input before querying", async () => {
        await expect(getITRequesterTicket(actorContext, 0))
            .rejects.toBeInstanceOf(ITTicketInputValidationError);
        await expect(listITRequesterTickets(actorContext, { page: 1, limit: 101 }))
            .rejects.toBeInstanceOf(ITTicketInputValidationError);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});
