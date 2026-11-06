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
        const findCategories = vi.fn().mockResolvedValue([
            { id: 19, name: "หมวดประวัติ", key: "ARCHIVED" },
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
                    .mockImplementationOnce(departmentGroupBy),
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
        expect(findCategories).toHaveBeenCalledWith({
            where: { id: { in: [19] } },
            select: { id: true, name: true, key: true },
        });
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
        }]);
        expect(result.departmentSnapshots).toEqual([
            { departmentNameSnapshot: null, count: 1 },
        ]);
    });
});
