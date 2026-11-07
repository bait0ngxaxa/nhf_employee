import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ITAuthorization from "./authorization";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    authorize: vi.fn(),
    assertWorkforce: vi.fn(),
    readSnapshot: vi.fn(),
    findCurrentEmployees: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: { $transaction: mocks.transaction },
}));

vi.mock("./authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof ITAuthorization>();
    return {
        ...actual,
        resolveITCapabilityInTransaction: mocks.authorize,
    };
});

vi.mock("./workforce", () => ({
    assertITActorCurrentWorkforce: mocks.assertWorkforce,
}));

vi.mock("../infrastructure/persistence/ticket-analytics-repository", () => ({
    readITAnalyticsPersistenceSnapshot: mocks.readSnapshot,
}));

vi.mock("@/modules/employee", () => ({
    findCurrentEmployeeDisplayProjections: mocks.findCurrentEmployees,
}));

import { Prisma } from "@prisma/client";

import {
    getITAnalyticsDashboard,
    ITAnalyticsInputValidationError,
    parseITAnalyticsPeriod,
} from "./analytics";
import { buildITAuthorizationContext } from "./authorization";
import type { ITAnalyticsPersistenceSnapshot } from "../infrastructure/persistence/ticket-analytics-repository";

const tx = {};
const now = new Date("2026-09-25T17:05:00.000Z");
const actor = buildITAuthorizationContext({ id: 41, role: "USER" }, 84);

const populatedSnapshot: ITAnalyticsPersistenceSnapshot = {
    statuses: [
        { status: "OPEN", count: 2 },
        { status: "WAITING_REQUESTER", count: 1 },
        { status: "RESOLVED", count: 3 },
        { status: "CLOSED", count: 4 },
        { status: "CANCELLED", count: 5 },
    ],
    types: [
        { type: "INCIDENT", count: 1 },
        { type: "SUGGESTION", count: 1 },
    ],
    priorities: [
        { priority: "P0", count: 1 },
        { priority: "P1", count: 2 },
        { priority: "P3", count: 1 },
    ],
    backlogPriorities: [
        { priority: "P0", count: 1 },
        { priority: "P1", count: 1 },
        { priority: "P2", count: 1 },
    ],
    untriagedBacklogCount: 2,
    backlogCategories: [
        { categoryId: 19, count: 2 },
        { categoryId: null, count: 1 },
    ],
    backlogAssignees: [
        { userId: 71, count: 1 },
        { userId: 72, count: 1 },
        { userId: null, count: 1 },
    ],
    backlogOldestCreatedAt: new Date("2026-09-20T00:00:00.000Z"),
    departmentSnapshots: [
        { departmentNameSnapshot: "หน่วยงาน ณ วันสร้าง", count: 1 },
        { departmentNameSnapshot: null, count: 1 },
    ],
    newTicketCount: 2,
    firstResponses: [
        {
            priority: "P0",
            createdAt: new Date("2026-09-25T15:00:00.000Z"),
            firstRespondedAt: new Date("2026-09-25T15:45:00.000Z"),
        },
        {
            priority: "P1",
            createdAt: new Date("2026-09-25T16:00:00.000Z"),
            firstRespondedAt: new Date("2026-09-25T16:20:00.000Z"),
        },
    ],
    createdAtValues: [
        new Date("2026-09-25T16:59:59.000Z"),
        new Date("2026-09-25T17:00:00.000Z"),
    ],
    resolvedEvents: [
        { ticketId: 91, occurredAt: new Date("2026-09-25T16:59:59.000Z") },
        { ticketId: 92, occurredAt: new Date("2026-09-25T17:00:00.000Z") },
    ],
    resolvedTickets: [
        { id: 91, createdAt: new Date("2026-09-25T15:59:59.000Z"), priority: "P1" },
        { id: 92, createdAt: new Date("2026-09-25T15:30:00.000Z"), priority: "P3" },
    ],
    createdCategories: [
        { categoryId: 19, count: 1 },
        { categoryId: null, count: 1 },
    ],
    backlogAges: [
        { key: "0_1", count: 1 },
        { key: "2_3", count: 0 },
        { key: "4_7", count: 1 },
        { key: "8_14", count: 0 },
        { key: "15_PLUS", count: 1 },
    ],
    categories: [{ id: 19, name: "หมวดประวัติที่ปิดแล้ว", key: "ARCHIVED", isActive: false }],
};

function useSnapshot(snapshot: ITAnalyticsPersistenceSnapshot): void {
    mocks.readSnapshot.mockResolvedValue(snapshot);
}

describe("IT analytics application query", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.transaction.mockImplementation(
            async (callback: (transaction: typeof tx) => unknown) => callback(tx),
        );
        mocks.authorize.mockResolvedValue({
            scopes: ["ALL"],
            decision: { reason: undefined },
        });
        mocks.assertWorkforce.mockResolvedValue({ employeeId: 84 });
        mocks.findCurrentEmployees.mockResolvedValue([{
            userId: 71,
            employeeId: 91,
            firstName: "อารี",
            lastName: "ใจดี",
            nickname: null,
        }]);
        useSnapshot(populatedSnapshot);
    });

    it("requires workforce and analytics ALL inside a RepeatableRead snapshot", async () => {
        await getITAnalyticsDashboard(actor, "7D", now);

        expect(mocks.assertWorkforce).toHaveBeenCalledWith(tx, actor);
        expect(mocks.authorize).toHaveBeenCalledWith(actor, "it.analytics.read", tx);
        expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        });
        expect(mocks.readSnapshot).toHaveBeenCalledTimes(1);
    });

    it("composes aggregate metrics from current backlog and period facts only", async () => {
        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result).toMatchObject({
            generatedAt: now.toISOString(),
            timeZone: "Asia/Bangkok",
            period: {
                key: "7D",
                startAt: "2026-09-19T17:00:00.000Z",
                endAt: now.toISOString(),
            },
            summary: {
                currentBacklog: 3,
                waitingRequester: 1,
                unassignedBacklog: 1,
                untriagedBacklog: 2,
                highPriorityBacklog: 2,
                agedBacklog: 1,
                oldestUnresolvedAgeMinutes: 8225,
                newTickets: 2,
                resolvedTickets: 2,
                firstRespondedTickets: 2,
                averageFirstResponseMinutes: 32.5,
                averageResolutionMinutes: 75,
            },
            typeDistribution: [
                { type: "INCIDENT", count: 1 },
                { type: "SERVICE_REQUEST", count: 0 },
                { type: "SUGGESTION", count: 1 },
            ],
            priorityDistribution: [
                { priority: "P0", count: 1 },
                { priority: "P1", count: 2 },
                { priority: "P2", count: 0 },
                { priority: "P3", count: 1 },
            ],
            priorityBacklog: [
                { priority: "P0", count: 1 },
                { priority: "P1", count: 1 },
                { priority: "P2", count: 1 },
                { priority: "P3", count: 0 },
            ],
            responseResolutionByPriority: [
                {
                    priority: "P0",
                    firstRespondedTickets: 1,
                    averageFirstResponseMinutes: 45,
                    resolvedTickets: 0,
                    averageResolutionMinutes: null,
                },
                {
                    priority: "P1",
                    firstRespondedTickets: 1,
                    averageFirstResponseMinutes: 20,
                    resolvedTickets: 1,
                    averageResolutionMinutes: 60,
                },
                {
                    priority: "P2",
                    firstRespondedTickets: 0,
                    averageFirstResponseMinutes: null,
                    resolvedTickets: 0,
                    averageResolutionMinutes: null,
                },
                {
                    priority: "P3",
                    firstRespondedTickets: 0,
                    averageFirstResponseMinutes: null,
                    resolvedTickets: 1,
                    averageResolutionMinutes: 90,
                },
            ],
            categoryBacklog: [
                { label: "หมวดประวัติที่ปิดแล้ว", count: 2 },
                { label: "ยังไม่จัดหมวดหมู่", count: 1 },
            ],
            assigneeBacklog: [
                { label: "ผู้รับผิดชอบเดิม", count: 1 },
                { label: "ยังไม่มีผู้รับผิดชอบ", count: 1 },
                { label: "อารี ใจดี", count: 1 },
            ],
            departmentCreated: [
                { label: "หน่วยงาน ณ วันสร้าง", count: 1 },
                { label: "ไม่ระบุหน่วยงาน", count: 1 },
            ],
        });
        expect(result.statusDistribution).toEqual([
            { status: "OPEN", count: 2 },
            { status: "IN_PROGRESS", count: 0 },
            { status: "WAITING_REQUESTER", count: 1 },
            { status: "RESOLVED", count: 3 },
            { status: "CLOSED", count: 4 },
            { status: "CANCELLED", count: 5 },
        ]);
        expect(result.trend).toHaveLength(7);
        expect(result.trend.filter((day) => day.created > 0)).toEqual([
            { date: "2026-09-25", created: 1, resolved: 1 },
            { date: "2026-09-26", created: 1, resolved: 1 },
        ]);
        expect(result.trend.slice(0, 5).every((day) =>
            day.created === 0 && day.resolved === 0,
        )).toBe(true);
        expect(mocks.readSnapshot.mock.calls[0]?.[1]).toMatchObject({
            backlogStatuses: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"],
            resolutionEventKind: "STATUS_CHANGED",
            resolutionStatus: "RESOLVED",
        });
    });

    it("preserves category identity while Department snapshots still group by normalized label", async () => {
        useSnapshot({
            ...populatedSnapshot,
            statuses: [{ status: "OPEN", count: 8 }],
            backlogCategories: [
                { categoryId: 19, count: 3 },
                { categoryId: 20, count: 5 },
            ],
            backlogAssignees: [{ userId: null, count: 8 }],
            departmentSnapshots: [
                { departmentNameSnapshot: "  ฝ่ายเดียวกัน  ", count: 2 },
                { departmentNameSnapshot: "ฝ่ายเดียวกัน", count: 3 },
            ],
            categories: [
                { id: 19, name: "ระบบ", key: "NETWORK", isActive: true },
                { id: 20, name: "ระบบ", key: "SOFTWARE", isActive: true },
            ],
        });

        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result.categoryBacklog).toEqual([
            { label: "ระบบ (SOFTWARE)", count: 5 },
            { label: "ระบบ (NETWORK)", count: 3 },
        ]);
        expect(result.assigneeBacklog).toEqual([
            { label: "ยังไม่มีผู้รับผิดชอบ", count: 8 },
        ]);
        expect(result.categoryBacklog.reduce((sum, row) => sum + row.count, 0))
            .toBe(result.summary.currentBacklog);
        expect(result.assigneeBacklog.reduce((sum, row) => sum + row.count, 0))
            .toBe(result.summary.currentBacklog);
        expect(result.departmentCreated).toEqual([
            { label: "ฝ่ายเดียวกัน", count: 5 },
        ]);
    });

    it("preserves distinct active assignee identities when display names collide", async () => {
        useSnapshot({
            ...populatedSnapshot,
            statuses: [{ status: "OPEN", count: 5 }],
            backlogCategories: [{ categoryId: 19, count: 5 }],
            backlogAssignees: [
                { userId: 205, count: 3 },
                { userId: 101, count: 2 },
            ],
            categories: [{ id: 19, name: "หมวดทั่วไป", key: "GENERAL", isActive: true }],
        });
        mocks.findCurrentEmployees.mockResolvedValue([
            {
                userId: 205,
                employeeId: 295,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
            },
            {
                userId: 101,
                employeeId: 191,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
            },
        ]);

        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result.assigneeBacklog).toEqual([
            { label: "สมชาย ใจดี (2)", count: 3 },
            { label: "สมชาย ใจดี (1)", count: 2 },
        ]);
        expect(result.assigneeBacklog.reduce((sum, row) => sum + row.count, 0))
            .toBe(result.summary.currentBacklog);
    });

    it("keeps separate fallback rows for distinct unresolved assignee identities", async () => {
        useSnapshot({
            ...populatedSnapshot,
            statuses: [{ status: "OPEN", count: 10 }],
            backlogCategories: [{ categoryId: null, count: 10 }],
            backlogAssignees: [
                { userId: 205, count: 6 },
                { userId: 101, count: 4 },
            ],
        });
        mocks.findCurrentEmployees.mockResolvedValue([]);

        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result.assigneeBacklog).toEqual([
            { label: "ผู้รับผิดชอบเดิม (2)", count: 6 },
            { label: "ผู้รับผิดชอบเดิม (1)", count: 4 },
        ]);
        expect(result.assigneeBacklog.reduce((sum, row) => sum + row.count, 0))
            .toBe(result.summary.currentBacklog);
    });

    it("defaults a missing period to 30D and rejects unsupported periods before querying", async () => {
        expect(parseITAnalyticsPeriod(undefined)).toBe("30D");
        expect(parseITAnalyticsPeriod("90D")).toBe("90D");
        await getITAnalyticsDashboard(actor, undefined, now);
        expect(mocks.readSnapshot.mock.calls[0]?.[1]).toMatchObject({
            startAt: new Date("2026-08-27T17:00:00.000Z"),
            endAt: now,
        });

        await expect(getITAnalyticsDashboard(actor, "365D", now))
            .rejects.toBeInstanceOf(ITAnalyticsInputValidationError);
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
    });

    it("denies inactive workforce before authorization or analytics reads", async () => {
        mocks.assertWorkforce.mockRejectedValueOnce(new Error("inactive workforce"));

        await expect(getITAnalyticsDashboard(actor, "30D", now))
            .rejects.toThrow("inactive workforce");
        expect(mocks.authorize).not.toHaveBeenCalled();
        expect(mocks.readSnapshot).not.toHaveBeenCalled();
    });

    it("does not use administrator or ticket capabilities as analytics authority", async () => {
        const administrator = buildITAuthorizationContext({ id: 42, role: "ADMIN" }, 85);
        mocks.authorize.mockRejectedValueOnce(new Error("no analytics grant"));
        await expect(getITAnalyticsDashboard(administrator, "30D", now))
            .rejects.toThrow("no analytics grant");
        expect(mocks.authorize).toHaveBeenCalledWith(
            administrator,
            "it.analytics.read",
            tx,
        );
        expect(mocks.readSnapshot).not.toHaveBeenCalled();

        mocks.authorize.mockResolvedValueOnce({
            scopes: ["ALL"],
            decision: { reason: undefined },
        });
        await getITAnalyticsDashboard(actor, "30D", now);
        expect(mocks.authorize).toHaveBeenLastCalledWith(actor, "it.analytics.read", tx);
    });

    it("returns complete zero data without inventing zero-duration samples", async () => {
        useSnapshot({
            statuses: [],
            types: [],
            backlogCategories: [],
            backlogAssignees: [],
            backlogOldestCreatedAt: null,
            priorities: [],
            backlogPriorities: [],
            untriagedBacklogCount: 0,
            departmentSnapshots: [],
            newTicketCount: 0,
            firstResponses: [],
            createdAtValues: [],
            resolvedEvents: [],
            resolvedTickets: [],
            createdCategories: [],
            backlogAges: [],
            categories: [],
        });

        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result.summary).toEqual({
            currentBacklog: 0,
            waitingRequester: 0,
            unassignedBacklog: 0,
            untriagedBacklog: 0,
            highPriorityBacklog: 0,
            agedBacklog: 0,
            oldestUnresolvedAgeMinutes: null,
            newTickets: 0,
            resolvedTickets: 0,
            firstRespondedTickets: 0,
            averageFirstResponseMinutes: null,
            averageResolutionMinutes: null,
        });
        expect(result.trend).toHaveLength(7);
        expect(result.trend.every((day) => day.created === 0 && day.resolved === 0)).toBe(true);
        expect(result.statusDistribution.every((row) => row.count === 0)).toBe(true);
        expect(result.typeDistribution.every((row) => row.count === 0)).toBe(true);
        expect(result.priorityDistribution).toEqual([
            { priority: "P0", count: 0 },
            { priority: "P1", count: 0 },
            { priority: "P2", count: 0 },
            { priority: "P3", count: 0 },
        ]);
        expect(result.priorityBacklog).toEqual([
            { priority: "P0", count: 0 },
            { priority: "P1", count: 0 },
            { priority: "P2", count: 0 },
            { priority: "P3", count: 0 },
        ]);
        expect(result.responseResolutionByPriority).toHaveLength(4);
        expect(result.categoryBacklog).toEqual([]);
        expect(result.assigneeBacklog).toEqual([]);
        expect(result.departmentCreated).toEqual([]);
        expect(result.topCategories).toEqual({
            limit: 10,
            rows: [],
            otherCategoryCount: 0,
            otherTicketCount: 0,
        });
        expect(result.backlogAging).toEqual([
            { bucket: "0_1", count: 0 },
            { bucket: "2_3", count: 0 },
            { bucket: "4_7", count: 0 },
            { bucket: "8_14", count: 0 },
            { bucket: "15_PLUS", count: 0 },
        ]);
        expect(result.filterOptions.categories).toEqual([]);
    });

    it("passes validated Ticket filters and one shared aging clock to every persistence read", async () => {
        const result = await getITAnalyticsDashboard(actor, {
            period: "7D",
            type: "INCIDENT",
            category: "19",
        }, now);

        const window = mocks.readSnapshot.mock.calls[0]?.[1];
        expect(window).toMatchObject({
            startAt: new Date("2026-09-19T17:00:00.000Z"),
            endAt: now,
            scope: { type: "INCIDENT", category: 19 },
        });
        expect(window?.backlogAgeRanges).toHaveLength(5);
        expect(window?.backlogAgeRanges[0]).toEqual({
            key: "0_1",
            createdAtLte: null,
            createdAtGt: new Date(now.getTime() - 2 * 86_400_000),
        });
        expect(result.filters).toEqual({ type: "INCIDENT", category: 19 });

        await getITAnalyticsDashboard(actor, { category: "uncategorized" }, now);
        expect(mocks.readSnapshot.mock.calls[1]?.[1]).toMatchObject({
            scope: { type: null, category: "uncategorized" },
        });
        await getITAnalyticsDashboard(actor, "30D", now);
        expect(mocks.readSnapshot.mock.calls[2]?.[1]).toMatchObject({
            scope: { type: null, category: null },
        });
    });

    it.each([
        { type: "incident" },
        { type: "" },
        { category: "0" },
        { category: "-1" },
        { category: "1.5" },
        { category: "UNCATEGORIZED" },
        { category: "2147483648" },
        { category: "" },
        { period: "1D" },
    ])("rejects malformed filters %o before opening the transaction", async (query) => {
        await expect(getITAnalyticsDashboard(actor, query, now))
            .rejects.toBeInstanceOf(ITAnalyticsInputValidationError);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("ranks period categories by canonical identity with deterministic ties and a summarized remainder", async () => {
        const categories = Array.from({ length: 12 }, (_, index) => ({
            id: 100 + index,
            name: `หมวด ${String.fromCharCode(65 + index)}`,
            key: `K${index}`,
            isActive: index !== 3,
        }));
        useSnapshot({
            ...populatedSnapshot,
            createdCategories: [
                ...categories.map((category, index) => ({
                    categoryId: category.id,
                    count: index < 2 ? 5 : 12 - index,
                })),
                { categoryId: null, count: 5 },
                { categoryId: 999, count: 0 },
            ],
            categories: [
                ...categories,
                { id: 200, name: "หมวด A", key: "DUPLICATE", isActive: true },
            ],
        });

        const result = await getITAnalyticsDashboard(actor, "30D", now);

        expect(result.topCategories.limit).toBe(10);
        expect(result.topCategories.rows).toHaveLength(10);
        expect(result.topCategories.rows.slice(0, 5)).toEqual([
            { categoryId: 102, label: "หมวด C", count: 10 },
            { categoryId: 103, label: "หมวด D", count: 9 },
            { categoryId: 104, label: "หมวด E", count: 8 },
            { categoryId: 105, label: "หมวด F", count: 7 },
            { categoryId: 106, label: "หมวด G", count: 6 },
        ]);
        // Equal counts: label order, then explicit uncategorized identity.
        expect(result.topCategories.rows.slice(5)).toEqual([
            { categoryId: null, label: "ยังไม่จัดหมวดหมู่", count: 5 },
            { categoryId: 100, label: "หมวด A", count: 5 },
            { categoryId: 101, label: "หมวด B", count: 5 },
            { categoryId: 107, label: "หมวด H", count: 5 },
            { categoryId: 108, label: "หมวด I", count: 4 },
        ]);
        expect(result.topCategories.otherCategoryCount).toBe(3);
        expect(result.topCategories.otherTicketCount).toBe(1 + 2 + 3);
        const total = result.topCategories.rows.reduce((sum, row) => sum + row.count, 0)
            + result.topCategories.otherTicketCount;
        expect(total).toBe(5 + 5 + 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3 + 2 + 1 + 5);
        expect(result.topCategories.rows.some((row) => row.categoryId === 999)).toBe(false);
    });

    it("disambiguates duplicate category names without merging their counts", async () => {
        useSnapshot({
            ...populatedSnapshot,
            createdCategories: [
                { categoryId: 19, count: 4 },
                { categoryId: 20, count: 4 },
            ],
            categories: [
                { id: 19, name: "ระบบ", key: "NETWORK", isActive: false },
                { id: 20, name: "ระบบ", key: "SOFTWARE", isActive: true },
            ],
        });

        const result = await getITAnalyticsDashboard(actor, "30D", now);

        expect(result.topCategories.rows).toEqual([
            { categoryId: 19, label: "ระบบ (NETWORK)", count: 4 },
            { categoryId: 20, label: "ระบบ (SOFTWARE)", count: 4 },
        ]);
        expect(result.filterOptions.categories).toEqual([
            { id: 20, key: "SOFTWARE", name: "ระบบ", isActive: true },
            { id: 19, key: "NETWORK", name: "ระบบ", isActive: false },
        ]);
    });

    it("derives high-priority and aged attention counts from the same current backlog snapshot", async () => {
        useSnapshot({
            ...populatedSnapshot,
            backlogPriorities: [
                { priority: "P0", count: 2 },
                { priority: "P1", count: 3 },
                { priority: "P2", count: 7 },
                { priority: "P3", count: 1 },
            ],
            backlogAges: [
                { key: "15_PLUS", count: 4 },
                { key: "0_1", count: 5 },
                { key: "8_14", count: 2 },
            ],
        });

        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result.summary.highPriorityBacklog).toBe(5);
        expect(result.summary.agedBacklog).toBe(6);
        expect(result.backlogAging).toEqual([
            { bucket: "0_1", count: 5 },
            { bucket: "2_3", count: 0 },
            { bucket: "4_7", count: 0 },
            { bucket: "8_14", count: 2 },
            { bucket: "15_PLUS", count: 4 },
        ]);
    });

    it("returns aggregate labels and counts without Ticket or requester details", async () => {
        const result = await getITAnalyticsDashboard(actor, "7D", now);
        const serialized = JSON.stringify(result);

        for (const forbidden of [
            "description",
            "requester",
            "requesterUserId",
            "ticketId",
            "ticketTitle",
            "comment",
            "attachment",
            "email",
        ]) {
            expect(serialized).not.toContain(forbidden);
        }
    });
});
