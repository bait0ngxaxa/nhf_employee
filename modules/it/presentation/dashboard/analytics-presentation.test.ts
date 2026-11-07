import { describe, expect, it } from "vitest";

import {
    formatITAnalyticsDateTime,
    formatITAnalyticsDuration,
    parseITAnalyticsDashboardResponse,
    readITAnalyticsError,
} from "./analytics-presentation";

const response = {
    success: true,
    dashboard: {
        generatedAt: "2026-09-25T17:05:00.000Z",
        timeZone: "Asia/Bangkok",
        period: {
            key: "30D",
            startAt: "2026-08-27T17:00:00.000Z",
            endAt: "2026-09-25T17:05:00.000Z",
        },
        filters: { type: null, category: null } as { type: string | null; category: number | string | null },
        filterOptions: {
            categories: [
                { id: 4, key: "HARDWARE", name: "อุปกรณ์คอมพิวเตอร์", isActive: true },
                { id: 9, key: "LEGACY", name: "หมวดเดิม", isActive: false },
            ],
        },
        summary: {
            currentBacklog: 1,
            waitingRequester: 0,
            unassignedBacklog: 1,
            untriagedBacklog: 1,
            highPriorityBacklog: 0,
            agedBacklog: 0,
            oldestUnresolvedAgeMinutes: 42,
            newTickets: 0,
            resolvedTickets: 0,
            firstRespondedTickets: 0,
            averageFirstResponseMinutes: null,
            averageResolutionMinutes: null,
        },
        trend: [{ date: "2026-09-26", created: 0, resolved: 0 }],
        statusDistribution: [
            { status: "OPEN", count: 1 },
            { status: "IN_PROGRESS", count: 0 },
            { status: "WAITING_REQUESTER", count: 0 },
            { status: "RESOLVED", count: 0 },
            { status: "CLOSED", count: 0 },
            { status: "CANCELLED", count: 0 },
        ],
        typeDistribution: [
            { type: "INCIDENT", count: 0 },
            { type: "SERVICE_REQUEST", count: 0 },
            { type: "SUGGESTION", count: 0 },
        ],
        priorityDistribution: [
            { priority: "P0", count: 0 },
            { priority: "P1", count: 0 },
            { priority: "P2", count: 1 },
            { priority: "P3", count: 0 },
        ],
        priorityBacklog: [
            { priority: "P0", count: 0 },
            { priority: "P1", count: 0 },
            { priority: "P2", count: 1 },
            { priority: "P3", count: 0 },
        ],
        responseResolutionByPriority: [
            { priority: "P0", firstRespondedTickets: 0, averageFirstResponseMinutes: null, resolvedTickets: 0, averageResolutionMinutes: null },
            { priority: "P1", firstRespondedTickets: 0, averageFirstResponseMinutes: null, resolvedTickets: 0, averageResolutionMinutes: null },
            { priority: "P2", firstRespondedTickets: 0, averageFirstResponseMinutes: null, resolvedTickets: 0, averageResolutionMinutes: null },
            { priority: "P3", firstRespondedTickets: 0, averageFirstResponseMinutes: null, resolvedTickets: 0, averageResolutionMinutes: null },
        ],
        topCategories: {
            limit: 10,
            rows: [
                { categoryId: 4, label: "อุปกรณ์คอมพิวเตอร์", count: 3 },
                { categoryId: null, label: "ยังไม่จัดหมวดหมู่", count: 1 },
            ] as { categoryId: number | null; label: string; count: number }[],
            otherCategoryCount: 0,
            otherTicketCount: 0,
        },
        backlogAging: [
            { bucket: "0_1", count: 1 },
            { bucket: "2_3", count: 0 },
            { bucket: "4_7", count: 0 },
            { bucket: "8_14", count: 0 },
            { bucket: "15_PLUS", count: 0 },
        ],
        categoryBacklog: [{ label: "ยังไม่จัดหมวดหมู่", count: 1 }],
        assigneeBacklog: [{ label: "ยังไม่มีผู้รับผิดชอบ", count: 1 }],
        departmentCreated: [],
    },
};

describe("IT analytics presentation contract", () => {
    it("parses only the aggregate dashboard contract", () => {
        expect(parseITAnalyticsDashboardResponse(response)).toMatchObject({
            timeZone: "Asia/Bangkok",
            period: { key: "30D" },
            summary: { currentBacklog: 1, averageResolutionMinutes: null },
            trend: [{ date: "2026-09-26", created: 0, resolved: 0 }],
        });
    });

    it("parses filters, filter options, top categories, and every aging bucket", () => {
        const filtered = structuredClone(response);
        filtered.dashboard.filters = { type: "INCIDENT", category: "uncategorized" };

        expect(parseITAnalyticsDashboardResponse(filtered)).toMatchObject({
            filters: { type: "INCIDENT", category: "uncategorized" },
            filterOptions: { categories: [{ id: 4 }, { id: 9, isActive: false }] },
            topCategories: { limit: 10, rows: [{ categoryId: 4 }, { categoryId: null }] },
            backlogAging: [
                { bucket: "0_1", count: 1 },
                { bucket: "2_3", count: 0 },
                { bucket: "4_7", count: 0 },
                { bucket: "8_14", count: 0 },
                { bucket: "15_PLUS", count: 0 },
            ],
            summary: { highPriorityBacklog: 0, agedBacklog: 0 },
        });
    });

    it.each([
        ["an unknown filter category", (value: typeof response) => {
            value.dashboard.filters = { type: null, category: "OTHER" };
        }],
        ["a non-canonical Ticket type filter", (value: typeof response) => {
            value.dashboard.filters = { type: "incident", category: null };
        }],
        ["a missing aging bucket", (value: typeof response) => {
            value.dashboard.backlogAging = value.dashboard.backlogAging.slice(0, 4);
        }],
        ["reordered aging buckets", (value: typeof response) => {
            value.dashboard.backlogAging = [...value.dashboard.backlogAging].reverse();
        }],
        ["more ranked rows than the limit", (value: typeof response) => {
            value.dashboard.topCategories.limit = 1;
        }],
        ["a non-integer category identity", (value: typeof response) => {
            value.dashboard.topCategories.rows = [{ categoryId: 1.5, label: "x", count: 1 }];
        }],
        ["duplicate filter option identities", (value: typeof response) => {
            value.dashboard.filterOptions.categories = [
                { id: 4, key: "A", name: "A", isActive: true },
                { id: 4, key: "B", name: "B", isActive: true },
            ];
        }],
        ["a missing attention count", (value: typeof response) => {
            const { agedBacklog: _removed, ...summary } = value.dashboard.summary;
            Object.assign(value.dashboard, { summary });
        }],
        ["a negative high-priority count", (value: typeof response) => {
            value.dashboard.summary.highPriorityBacklog = -1;
        }],
    ])("rejects %s", (_label, mutate) => {
        const invalid = structuredClone(response);
        mutate(invalid);

        expect(parseITAnalyticsDashboardResponse(invalid)).toBeNull();
    });

    it("rejects extra Ticket or requester details instead of passing them to the page", () => {
        const leaking = structuredClone(response);
        Object.assign(leaking.dashboard, { tickets: [{ id: 27, title: "private" }] });

        expect(parseITAnalyticsDashboardResponse(leaking)).toBeNull();
    });

    it("formats durations after rounding and distinguishes missing samples from zero", () => {
        expect(formatITAnalyticsDuration(null)).toBe("ยังไม่มีข้อมูล");
        expect(formatITAnalyticsDuration(42)).toBe("42 นาที");
        expect(formatITAnalyticsDuration(138)).toBe("2 ชม. 18 นาที");
        expect(formatITAnalyticsDuration(1_620)).toBe("1 วัน 3 ชม.");
        expect(formatITAnalyticsDuration(42.5)).toBe("43 นาที");
    });

    it("formats report timestamps in the fixed Bangkok timezone", () => {
        const value = formatITAnalyticsDateTime("2026-09-25T17:05:00.000Z");

        expect(value).toContain("00:05");
        expect(value).not.toContain("17:05");
    });

    it("uses safe Thai API error messages", () => {
        expect(readITAnalyticsError(401)).toContain("เซสชันหมดอายุ");
        expect(readITAnalyticsError(403)).toContain("ไม่มีสิทธิ์");
        expect(readITAnalyticsError(500)).toContain("ขัดข้องชั่วคราว");
    });
});
