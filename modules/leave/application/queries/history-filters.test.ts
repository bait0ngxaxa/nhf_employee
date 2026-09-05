import { describe, expect, it } from "vitest";

import {
    buildApproverLeaveHistoryFilterWhere,
    buildEmployeeLeaveHistoryFilterWhere,
    createLeaveHistoryYearRange,
    getAvailableLeaveHistoryYears,
    parseApproverLeaveHistoryFilters,
    parseEmployeeLeaveHistoryFilters,
} from "./history-filters";

describe("leave history filters", () => {
    it("normalizes employee history filters", () => {
        const result = parseEmployeeLeaveHistoryFilters(
            new URL(
                "http://localhost/api/leave/me?q=%20%E0%B9%84%E0%B8%82%E0%B9%89%20&leaveType=SICK&status=APPROVED&year=2026",
            ),
        );

        expect(result).toEqual({
            success: true,
            filters: {
                query: "ไข้",
                leaveType: "SICK",
                status: "APPROVED",
                year: 2026,
            },
        });
    });

    it.each([
        "leaveType=INVALID",
        "status=NOT_A_STATUS",
        "year=hello",
        "year=0",
        `q=${"x".repeat(201)}`,
    ])("rejects invalid employee filter query: %s", (query) => {
        const result = parseEmployeeLeaveHistoryFilters(
            new URL(`http://localhost/api/leave/me?${query}`),
        );

        expect(result.success).toBe(false);
    });

    it("rejects statuses that cannot occur in approver history", () => {
        const result = parseApproverLeaveHistoryFilters(
            new URL("http://localhost/api/leave/approvals?historyStatus=PENDING"),
        );

        expect(result.success).toBe(false);
    });

    it("builds employee text, enum, and leave-date filters together", () => {
        expect(
            buildEmployeeLeaveHistoryFilterWhere({
                query: "ไข้",
                leaveType: "SICK",
                status: "APPROVED",
                year: 2026,
            }),
        ).toEqual({
            AND: [
                {
                    OR: [
                        { reason: { contains: "ไข้" } },
                        { emergencyReason: { contains: "ไข้" } },
                        { specialReason: { contains: "ไข้" } },
                        { rejectReason: { contains: "ไข้" } },
                        { notTakenReason: { contains: "ไข้" } },
                        { cancellationReason: { contains: "ไข้" } },
                    ],
                },
                { leaveType: "SICK" },
                { status: "APPROVED" },
                {
                    startDate: {
                        gte: new Date("2026-01-01T00:00:00.000Z"),
                        lt: new Date("2027-01-01T00:00:00.000Z"),
                    },
                },
            ],
        });
    });

    it("builds approver employee-name search without adding ownership fields", () => {
        expect(
            buildApproverLeaveHistoryFilterWhere({
                query: "สมชาย",
                leaveType: "SICK",
                status: "APPROVED",
                year: 2026,
            }),
        ).toEqual({
            AND: [
                {
                    employee: {
                        OR: [
                            { firstName: { contains: "สมชาย" } },
                            { lastName: { contains: "สมชาย" } },
                            { nickname: { contains: "สมชาย" } },
                        ],
                    },
                },
                { leaveType: "SICK" },
                { status: "APPROVED" },
                {
                    startDate: {
                        gte: new Date("2026-01-01T00:00:00.000Z"),
                        lt: new Date("2027-01-01T00:00:00.000Z"),
                    },
                },
            ],
        });
    });

    it("returns no database predicate when all filters are empty", () => {
        expect(buildEmployeeLeaveHistoryFilterWhere({})).toBeNull();
        expect(buildApproverLeaveHistoryFilterWhere({})).toBeNull();
    });

    it("creates an index-friendly half-open leave-date range", () => {
        expect(createLeaveHistoryYearRange(2026)).toEqual({
            startOfYear: new Date("2026-01-01T00:00:00.000Z"),
            endOfYear: new Date("2027-01-01T00:00:00.000Z"),
        });
    });

    it("creates descending year options from an authorized history date range", () => {
        expect(
            getAvailableLeaveHistoryYears(
                new Date("2024-06-20T00:00:00.000Z"),
                new Date("2026-09-14T00:00:00.000Z"),
            ),
        ).toEqual([2026, 2025, 2024]);
    });

    it("returns no year options when the authorized history is empty", () => {
        expect(getAvailableLeaveHistoryYears(null, null)).toEqual([]);
    });
});
