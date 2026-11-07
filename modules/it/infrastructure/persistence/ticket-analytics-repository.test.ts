import { describe, expect, it, vi } from "vitest";

import { ITTicketEventKind, ITTicketStatus } from "@prisma/client";

import {
    readITAnalyticsPersistenceSnapshot,
    type ITTicketAnalyticsPersistenceContext,
} from "./ticket-analytics-repository";

describe("IT Ticket analytics persistence", () => {
    it("uses period predicates, grouped facts, narrow projections, and distinct resolved Ticket IDs", async () => {
        const startAt = new Date("2026-09-01T17:00:00.000Z");
        const endAt = new Date("2026-09-25T17:00:00.000Z");
        const statusGroupBy = vi.fn().mockResolvedValue([
            { status: "OPEN", _count: { _all: 2 } },
        ]);
        const priorityGroupBy = vi.fn().mockResolvedValue([
            { priority: "P0", _count: { _all: 1 } },
        ]);
        const categoryGroupBy = vi.fn().mockResolvedValue([
            { categoryId: 19, _count: { _all: 2 } },
            { categoryId: null, _count: { _all: 1 } },
        ]);
        const assigneeGroupBy = vi.fn().mockResolvedValue([
            { assignedToUserId: null, _count: { _all: 1 } },
        ]);
        const backlogPriorityGroupBy = vi.fn().mockResolvedValue([
            { priority: "P0", _count: { _all: 1 } },
        ]);
        const typeGroupBy = vi.fn().mockResolvedValue([
            { type: "INCIDENT", _count: { _all: 1 } },
        ]);
        const departmentGroupBy = vi.fn().mockResolvedValue([
            { requesterDepartmentNameSnapshot: null, _count: { _all: 1 } },
        ]);
        const eventGroupBy = vi.fn().mockResolvedValue([
            { ticketId: 41, _min: { occurredAt: new Date("2026-09-02T01:00:00.000Z") } },
        ]);
        const aggregate = vi.fn().mockResolvedValue({
            _min: { createdAt: new Date("2026-08-01T00:00:00.000Z") },
        });
        const count = vi.fn().mockResolvedValue(1);
        const findMany = vi.fn()
            .mockResolvedValueOnce([{
                priority: "P0",
                createdAt: new Date("2026-09-02T00:00:00.000Z"),
                firstRespondedAt: new Date("2026-09-02T00:20:00.000Z"),
            }])
            .mockResolvedValueOnce([{ createdAt: new Date("2026-09-02T00:00:00.000Z") }])
            .mockResolvedValueOnce([{
                id: 41,
                createdAt: new Date("2026-09-01T12:00:00.000Z"),
                priority: "P0",
            }]);
        const createdCategoryGroupBy = vi.fn().mockResolvedValue([
            { categoryId: 19, _count: { _all: 1 } },
        ]);
        const findCategories = vi.fn().mockResolvedValue([
            { id: 19, name: "หมวดประวัติ", key: "ARCHIVED", isActive: false },
        ]);
        const tx = {
            iTTicket: {
                groupBy: vi.fn()
                    .mockImplementationOnce(statusGroupBy)
                    .mockImplementationOnce(priorityGroupBy)
                    .mockImplementationOnce(categoryGroupBy)
                    .mockImplementationOnce(assigneeGroupBy)
                    .mockImplementationOnce(backlogPriorityGroupBy)
                    .mockImplementationOnce(typeGroupBy)
                    .mockImplementationOnce(departmentGroupBy)
                    .mockImplementationOnce(createdCategoryGroupBy),
                aggregate,
                count,
                findMany,
            },
            iTTicketEvent: { groupBy: eventGroupBy },
            iTTicketCategory: { findMany: findCategories },
        } as unknown as ITTicketAnalyticsPersistenceContext;

        const result = await readITAnalyticsPersistenceSnapshot(tx, {
            startAt,
            endAt,
            backlogStatuses: [
                ITTicketStatus.OPEN,
                ITTicketStatus.IN_PROGRESS,
                ITTicketStatus.WAITING_REQUESTER,
            ],
            resolutionEventKind: ITTicketEventKind.STATUS_CHANGED,
            resolutionStatus: ITTicketStatus.RESOLVED,
        });

        expect(statusGroupBy).toHaveBeenCalledWith({
            by: ["status"],
            _count: { _all: true },
        });
        expect(priorityGroupBy).toHaveBeenCalledWith({
            by: ["priority"],
            _count: { _all: true },
        });
        expect(categoryGroupBy).toHaveBeenCalledWith({
            by: ["categoryId"],
            where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] } },
            _count: { _all: true },
        });
        expect(departmentGroupBy).toHaveBeenCalledWith({
            by: ["requesterDepartmentNameSnapshot"],
            where: { createdAt: { gte: startAt, lt: endAt } },
            _count: { _all: true },
        });
        expect(backlogPriorityGroupBy).toHaveBeenCalledWith({
            by: ["priority"],
            where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] } },
            _count: { _all: true },
        });
        expect(count).toHaveBeenCalledWith({
            where: {
                status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] },
                triagedAt: null,
            },
        });
        expect(eventGroupBy).toHaveBeenCalledWith({
            by: ["ticketId"],
            where: {
                kind: "STATUS_CHANGED",
                toStatus: "RESOLVED",
                occurredAt: { gte: startAt, lt: endAt },
            },
            _min: { occurredAt: true },
        });
        expect(createdCategoryGroupBy).toHaveBeenCalledWith({
            by: ["categoryId"],
            where: { createdAt: { gte: startAt, lt: endAt } },
            _count: { _all: true },
        });
        expect(findCategories).toHaveBeenCalledWith({
            where: { OR: [{ isActive: true }, { tickets: { some: {} } }] },
            select: { id: true, name: true, key: true, isActive: true },
            orderBy: { id: "asc" },
        });
        // No aging ranges requested: no extra unbounded counts.
        expect(count).toHaveBeenCalledTimes(2);
        expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: {
                createdAt: { gte: startAt, lt: endAt },
                firstRespondedAt: { not: null },
            },
            select: { priority: true, createdAt: true, firstRespondedAt: true },
        }));
        expect(result.resolvedEvents).toHaveLength(1);
        expect(result.priorities).toEqual([{ priority: "P0", count: 1 }]);
        expect(result.backlogPriorities).toEqual([{ priority: "P0", count: 1 }]);
        expect(result.untriagedBacklogCount).toBe(1);
        expect(result.firstResponses[0]).toMatchObject({ priority: "P0" });
        expect(result.resolvedTickets[0]).toMatchObject({ priority: "P0" });
        expect(result.categories).toEqual([{
            id: 19,
            name: "หมวดประวัติ",
            key: "ARCHIVED",
            isActive: false,
        }]);
        expect(result.createdCategories).toEqual([{ categoryId: 19, count: 1 }]);
        expect(result.backlogAges).toEqual([]);
        expect(result.departmentSnapshots).toEqual([
            { departmentNameSnapshot: null, count: 1 },
        ]);
    });
    it("applies Ticket type/category scope to every Ticket aggregate and counts aging ranges on the backlog", async () => {
        const startAt = new Date("2026-09-01T17:00:00.000Z");
        const endAt = new Date("2026-09-25T17:00:00.000Z");
        const groupBy = vi.fn().mockResolvedValue([]);
        const count = vi.fn().mockResolvedValue(3);
        const aggregate = vi.fn().mockResolvedValue({ _min: { createdAt: null } });
        const findMany = vi.fn().mockResolvedValue([]);
        const eventGroupBy = vi.fn().mockResolvedValue([]);
        const findCategories = vi.fn().mockResolvedValue([]);
        const queryRaw = vi.fn().mockResolvedValue([
            { bucket: "0_1", count: BigInt(3) }, { bucket: "8_14", count: BigInt(3) }, { bucket: "15_PLUS", count: BigInt(3) },
        ]);
        const tx = {
            $queryRaw: queryRaw,
            iTTicket: { groupBy, count, aggregate, findMany },
            iTTicketEvent: { groupBy: eventGroupBy },
            iTTicketCategory: { findMany: findCategories },
        } as unknown as ITTicketAnalyticsPersistenceContext;
        const lte = new Date("2026-09-17T17:00:00.000Z");
        const gt = new Date("2026-09-10T17:00:00.000Z");

        const result = await readITAnalyticsPersistenceSnapshot(tx, {
            startAt,
            endAt,
            backlogStatuses: [ITTicketStatus.OPEN],
            resolutionEventKind: ITTicketEventKind.STATUS_CHANGED,
            resolutionStatus: ITTicketStatus.RESOLVED,
            scope: { type: "INCIDENT", category: "uncategorized" },
            backlogAgeRanges: [
                { key: "0_1", createdAtLte: null, createdAtGt: gt },
                { key: "8_14", createdAtLte: lte, createdAtGt: gt },
                { key: "15_PLUS", createdAtLte: lte, createdAtGt: null },
            ],
        });

        const scope = { type: "INCIDENT", categoryId: null };
        for (const [call] of groupBy.mock.calls) {
            expect(call.where).toMatchObject(scope);
        }
        expect(groupBy).toHaveBeenCalledTimes(8);
        expect(groupBy.mock.calls[0]?.[0]).toEqual({
            by: ["status"],
            where: scope,
            _count: { _all: true },
        });
        expect(aggregate).toHaveBeenCalledWith({
            where: { ...scope, status: { in: ["OPEN"] } },
            _min: { createdAt: true },
        });
        expect(eventGroupBy).toHaveBeenCalledWith({
            by: ["ticketId"],
            where: {
                kind: "STATUS_CHANGED",
                toStatus: "RESOLVED",
                occurredAt: { gte: startAt, lt: endAt },
                ticket: scope,
            },
            _min: { occurredAt: true },
        });
        expect(count).toHaveBeenCalledTimes(2); // period and untriaged only
        expect(queryRaw).toHaveBeenCalledTimes(1);
        const statement = queryRaw.mock.calls[0]?.[0];
        expect(statement.sql).toContain("categoryId IS NULL");
        expect(statement.sql).toContain("GROUP BY bucket");
        expect(statement.values).toEqual([
            gt, "0_1", lte, gt, "8_14", lte, "15_PLUS", "OPEN", "INCIDENT",
        ]);
        // Filter options are reference data and stay unscoped.
        expect(findCategories).toHaveBeenCalledWith(expect.objectContaining({
            where: { OR: [{ isActive: true }, { tickets: { some: {} } }] },
        }));
        expect(result.backlogAges).toEqual([
            { key: "0_1", count: 3 },
            { key: "8_14", count: 3 },
            { key: "15_PLUS", count: 3 },
        ]);
    });
});
