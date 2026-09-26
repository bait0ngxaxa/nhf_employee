import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthorizationModule from "./authorization";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findCategories: vi.fn(),
    findFirst: vi.fn(),
    authorize: vi.fn(),
    assertWorkforce: vi.fn(),
    findConfiguredRecipients: vi.fn(),
    findCurrentEmployeeDisplays: vi.fn(),
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

vi.mock("@/modules/authorization", () => ({
    findActiveUsersWithConfiguredCapabilityScope: mocks.findConfiguredRecipients,
}));

vi.mock("@/modules/employee", () => ({
    findCurrentEmployeeDisplayProjections: mocks.findCurrentEmployeeDisplays,
    getEmployeeDisplayName: (employee: { firstName: string; lastName: string; nickname: string | null }) =>
        `${employee.firstName} ${employee.lastName}${employee.nickname ? ` (${employee.nickname})` : ""}`,
}));

import {
    getITOperatorReferenceData,
    getITOperatorTicket,
    getITRequesterTicket,
    listITOperatorTickets,
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
    iTTicketCategory: { findMany: mocks.findCategories },
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
    requesterUserId: 41,
    assignedToUserId: null,
    categoryId: null,
    requesterDepartmentId: 9,
    requesterDepartmentNameSnapshot: "แผนกตัวอย่าง",
    version: 4,
    requester: {
        id: 41,
        name: "ผู้ใช้ตัวอย่าง",
        email: "staff@example.test",
        employee: { firstName: "สมชาย", lastName: "ใจดี", nickname: "ชาย" },
    },
    assignedTo: null,
    category: null,
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
        mocks.findFirst.mockResolvedValue({ ...ticket, attachments: [] });
        mocks.findCategories.mockResolvedValue([]);
        mocks.findConfiguredRecipients.mockImplementation(async ({ capability }: { capability: string }) =>
            capability === "it.ticket.read" ? [51, 52]
                : capability === "it.ticket.comment" ? [51]
                    : [51, 53]);
        mocks.findCurrentEmployeeDisplays.mockResolvedValue([{
            userId: 51,
            employeeId: 91,
            firstName: "อารี",
            lastName: "ใจเย็น",
            nickname: null,
        }]);
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

    it("denies OWN-only operators before any organization-wide Ticket query", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["OWN"] });

        await expect(listITOperatorTickets(actorContext, {})).rejects.toThrow();

        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    it("rechecks read ALL on every queue request after a loaded operator loses authority", async () => {
        mocks.authorize
            .mockResolvedValueOnce({ scopes: ["ALL"] })
            .mockResolvedValueOnce({ scopes: [] });

        await expect(listITOperatorTickets(actorContext, {})).resolves.toMatchObject({
            tickets: [expect.objectContaining({ id: 19 })],
        });
        await expect(listITOperatorTickets(actorContext, {})).rejects.toThrow();

        expect(mocks.findMany).toHaveBeenCalledTimes(1);
    });

    it("requires read ALL for operator detail before looking up any Ticket", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["OWN"] });

        await expect(getITOperatorTicket(actorContext, 19)).rejects.toThrow();

        expect(mocks.findFirst).not.toHaveBeenCalled();
    });

    it("retains an inactive attached category on operator detail", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["ALL"] });
        mocks.findFirst.mockResolvedValueOnce({
            ...ticket,
            attachments: [],
            category: { id: 7, key: "OLD", name: "หมวดหมู่เดิม", isActive: false },
        });

        await expect(getITOperatorTicket(actorContext, 19)).resolves.toMatchObject({
            category: { id: 7, key: "OLD", name: "หมวดหมู่เดิม", isActive: false },
        });
    });

    it("returns a bounded explicit operator DTO and stable newest-first queue", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["ALL"] });
        mocks.findMany.mockResolvedValueOnce([ticket, { ...ticket, id: 18 }]);

        const result = await listITOperatorTickets(actorContext, { limit: 1 });

        expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {},
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 2,
        }));
        expect(result.tickets).toHaveLength(1);
        expect(result.nextCursor).not.toBeNull();
        expect(result.tickets[0]).toMatchObject({
            id: 19,
            requester: {
                userId: 41,
                displayName: "สมชาย ใจดี (ชาย)",
                departmentId: 9,
                departmentNameSnapshot: "แผนกตัวอย่าง",
            },
            assignee: null,
            category: null,
            version: 4,
        });
        expect(result.tickets[0]).not.toHaveProperty("requesterUserId");
        expect(result.tickets[0]).not.toHaveProperty("assignedToUserId");
        expect(result.tickets[0]).not.toHaveProperty("events");
    });

    it("uses both createdAt and id for equal-timestamp cursor boundaries", async () => {
        mocks.authorize.mockResolvedValue({ scopes: ["ALL"] });
        const newest = { ...ticket, id: 20 };
        const sameTimeOlder = { ...ticket, id: 19 };
        mocks.findMany
            .mockResolvedValueOnce([newest, sameTimeOlder])
            .mockResolvedValueOnce([sameTimeOlder]);

        const firstPage = await listITOperatorTickets(actorContext, { limit: 1 });
        await listITOperatorTickets(actorContext, {
            limit: 1,
            cursor: firstPage.nextCursor ?? undefined,
        });

        expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
            where: {
                OR: [
                    { createdAt: { lt: createdAt } },
                    { createdAt, id: { lt: 20 } },
                ],
            },
        }));
    });

    it("applies status, type, category, and assignment filters in the database query", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["ALL"] });
        mocks.findMany.mockResolvedValueOnce([]);

        await listITOperatorTickets(actorContext, {
            status: "IN_PROGRESS",
            type: "INCIDENT",
            categoryId: "uncategorized",
            assignmentState: "UNASSIGNED",
            limit: 12,
        });

        expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                status: "IN_PROGRESS",
                type: "INCIDENT",
                categoryId: null,
                assignedToUserId: null,
            },
            take: 13,
        }));
    });

    it("applies a selected assignee as a database predicate", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["ALL"] });
        mocks.findMany.mockResolvedValueOnce([]);

        await listITOperatorTickets(actorContext, {
            assignmentState: "ASSIGNED",
            assigneeUserId: 51,
        });

        expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { assignedToUserId: 51 },
        }));
    });

    it("rejects malformed cursors and filters without querying Tickets", async () => {
        await expect(listITOperatorTickets(actorContext, { cursor: "not a cursor" }))
            .rejects.toBeInstanceOf(ITTicketInputValidationError);
        await expect(listITOperatorTickets(actorContext, { scope: "all" }))
            .rejects.toBeInstanceOf(ITTicketInputValidationError);
        await expect(listITOperatorTickets(actorContext, { limit: 101 }))
            .rejects.toBeInstanceOf(ITTicketInputValidationError);
        await expect(listITOperatorTickets(actorContext, {
            assignmentState: "UNASSIGNED",
            assigneeUserId: 51,
        })).rejects.toBeInstanceOf(ITTicketInputValidationError);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("shows only active categories and the intersection of configured operator grants", async () => {
        mocks.authorize.mockResolvedValueOnce({ scopes: ["ALL"] });
        mocks.findCategories.mockResolvedValueOnce([
            { id: 4, key: "NETWORK", name: "เครือข่าย" },
        ]);

        const result = await getITOperatorReferenceData(actorContext);

        expect(mocks.findCategories).toHaveBeenCalledWith({
            where: { isActive: true },
            select: { id: true, key: true, name: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        expect(mocks.findConfiguredRecipients).toHaveBeenCalledTimes(3);
        expect(result).toEqual({
            categories: [{ id: 4, key: "NETWORK", name: "เครือข่าย" }],
            assignableOperators: [{
                userId: 51,
                employeeId: 91,
                displayName: "อารี ใจเย็น",
            }],
        });
    });
});
