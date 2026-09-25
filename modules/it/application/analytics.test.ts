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
            createdAt: new Date("2026-09-25T15:00:00.000Z"),
            firstRespondedAt: new Date("2026-09-25T15:45:00.000Z"),
        },
        {
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
        { id: 91, createdAt: new Date("2026-09-25T15:59:59.000Z") },
        { id: 92, createdAt: new Date("2026-09-25T15:30:00.000Z") },
    ],
    categories: [{ id: 19, name: "หมวดประวัติที่ปิดแล้ว", key: "ARCHIVED" }],
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
                { id: 19, name: "ระบบ", key: "NETWORK" },
                { id: 20, name: "ระบบ", key: "SOFTWARE" },
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
            categories: [{ id: 19, name: "หมวดทั่วไป", key: "GENERAL" }],
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
            departmentSnapshots: [],
            newTicketCount: 0,
            firstResponses: [],
            createdAtValues: [],
            resolvedEvents: [],
            resolvedTickets: [],
            categories: [],
        });

        const result = await getITAnalyticsDashboard(actor, "7D", now);

        expect(result.summary).toEqual({
            currentBacklog: 0,
            waitingRequester: 0,
            unassignedBacklog: 0,
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
        expect(result.categoryBacklog).toEqual([]);
        expect(result.assigneeBacklog).toEqual([]);
        expect(result.departmentCreated).toEqual([]);
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
