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
        previousPeriod: {
            startAt: "2026-07-29T16:55:00.000Z",
            endAt: "2026-08-27T17:00:00.000Z",
            newTickets: { count: 0, percentageChange: 0 as number | null },
            resolvedTickets: { count: 0, percentageChange: 0 as number | null },
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
            closedTickets: 0,
            cancelledTickets: 0,
            reopenedTickets: 0,
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
            previousPeriod: response.dashboard.previousPeriod,
            summary: { currentBacklog: 1, resolvedTickets: 0, oldestUnresolvedAgeMinutes: 42, reopenedTickets: 0 },
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
        ["an overlapping comparison window", (value: typeof response) => {
            value.dashboard.previousPeriod.endAt = "2026-08-27T17:00:01.000Z";
        }],
        ["a shorter comparison window", (value: typeof response) => {
            value.dashboard.previousPeriod.startAt = "2026-07-29T16:56:00.000Z";
        }],
        ["a non-finite comparison", (value: typeof response) => {
            value.dashboard.previousPeriod.newTickets.percentageChange = Infinity;
        }],
        ["a percentage over zero baseline", (value: typeof response) => {
            value.dashboard.previousPeriod.newTickets.percentageChange = 100;
        }],
        ["a null change over a positive baseline", (value: typeof response) => {
            value.dashboard.previousPeriod.resolvedTickets = { count: 1, percentageChange: null };
        }],
        ["a missing lifecycle count", (value: typeof response) => {
            const { reopenedTickets: _removed, ...summary } = value.dashboard.summary;
            Object.assign(value.dashboard, { summary });
        }],
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
        ["a missing resolved Ticket count", (value: typeof response) => {
            const { resolvedTickets: _removed, ...summary } = value.dashboard.summary;
            Object.assign(value.dashboard, { summary });
        }],
        ["an invalid oldest unresolved age", (value: typeof response) => {
            Object.assign(value.dashboard.summary, { oldestUnresolvedAgeMinutes: Infinity });
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

    it("formats backlog age, including rounding and an unavailable value", () => {
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
