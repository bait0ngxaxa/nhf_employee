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
        summary: {
            currentBacklog: 1,
            waitingRequester: 0,
            unassignedBacklog: 1,
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
