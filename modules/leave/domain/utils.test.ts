// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
    getLeaveDateRangeIssue,
    evaluateLeaveSelection,
    calculateLeaveDuration,
    getCalendarDaysAgo,
    getStartOfDay,
    getWorkingDays,
    isAfterLeaveEnd,
    isBeforeLeaveStart,
    isPastDate,
    isWorkingDay,
    isWithinEmergencyBackdateWindow,
} from "./utils";
import {
    getBusinessDate,
    toDateOnlyString,
} from "./business-date";

describe("leave business date utilities", () => {
    it.each([
        ["2031-02-30", "2031-02-30", "invalid"],
        ["2030-05-12", "2030-05-09", "reversed"],
        ["2030-12-31", "2031-01-02", "cross-year"],
        ["2030-05-09", "2030-05-13", null],
    ] as const)("identifies the current leave date-range rules", (start, end, issue) => {
        expect(getLeaveDateRangeIssue(start, end)).toBe(issue);
    });

    it("parses date-only values without using the process timezone", () => {
        expect(getBusinessDate("2026-12-31")).toEqual({
            year: 2026,
            month: 12,
            day: 31,
        });
        expect(toDateOnlyString(new Date("2026-12-31T16:59:59.999Z"))).toBe(
            "2026-12-31",
        );
        expect(toDateOnlyString(new Date("2026-12-31T17:00:00.000Z"))).toBe(
            "2027-01-01",
        );
    });

    it("changes business date at Bangkok midnight", () => {
        const beforeBangkokMidnight = new Date("2026-01-01T16:59:59.999Z");
        const bangkokMidnight = new Date("2026-01-01T17:00:00.000Z");

        expect(isPastDate("2026-01-02", beforeBangkokMidnight)).toBe(false);
        expect(isPastDate("2026-01-01", bangkokMidnight)).toBe(true);
        expect(isBeforeLeaveStart("2026-01-02", beforeBangkokMidnight)).toBe(true);
        expect(isBeforeLeaveStart("2026-01-02", bangkokMidnight)).toBe(false);
        expect(isAfterLeaveEnd("2026-01-01", beforeBangkokMidnight)).toBe(false);
        expect(isAfterLeaveEnd("2026-01-01", bangkokMidnight)).toBe(true);
    });

    it("counts calendar days across month and year boundaries", () => {
        expect(getCalendarDaysAgo("2025-12-31", "2026-01-01")).toBe(1);
        expect(getCalendarDaysAgo("2026-01-01", "2026-01-01")).toBe(0);
        expect(getWorkingDays("2026-01-30", "2026-02-02")).toBe(2);
        expect(getWorkingDays("2026-12-31", "2027-01-04")).toBe(3);
    });

    it("uses calendar weekdays and enforces the seven-day backdate window", () => {
        expect(isWorkingDay("2026-01-30")).toBe(true);
        expect(isWorkingDay("2026-01-31")).toBe(false);
        expect(isWithinEmergencyBackdateWindow("2026-01-01", "2026-01-08")).toBe(true);
        expect(isWithinEmergencyBackdateWindow("2026-01-01", "2026-01-09")).toBe(false);
        expect(getStartOfDay("2026-01-01").toISOString()).toBe(
            "2026-01-01T00:00:00.000Z",
        );
    });
});


describe("leave selection", () => {
    it.each([
        ["2030-05-11", "2030-05-11", "FULL_DAY", "weekend-single"],
        ["2030-05-12", "2030-05-12", "FULL_DAY", "weekend-single"],
        ["2030-05-11", "2030-05-13", "FULL_DAY", "weekend-start"],
        ["2030-05-10", "2030-05-12", "FULL_DAY", "weekend-end"],
        ["2030-05-11", "2030-05-19", "FULL_DAY", "weekend-both"],
        ["2030-05-11", "2030-05-12", "FULL_DAY", "no-working-days"],
        ["2030-05-09", "2030-05-10", "MORNING", "half-day-multi-date"],
        ["2030-05-13", "2030-05-09", "FULL_DAY", "reversed"],
        ["2030-12-31", "2031-01-01", "FULL_DAY", "cross-year"],
        ["2030-02-30", "2030-02-30", "FULL_DAY", "invalid"],
    ] as const)("rejects %s to %s", (start, end, period, issue) => {
        const result = evaluateLeaveSelection(start, end, period);
        expect(result.valid).toBe(false);
        if (!result.valid) { expect(result.issue).toBe(issue); expect(result.message).toBeTruthy(); }
    });

    it.each(["MORNING", "AFTERNOON"] as const)("counts %s as half a day", (period) => {
        expect(evaluateLeaveSelection("2030-05-09", "2030-05-09", period)).toEqual({ valid: true, breakdown: { calendarDays: 1, weekendDays: 0, workingDays: 1, requestedDays: 0.5 } });
    });
    it("explains weekends and refuses a zero-day calculation", () => {
        expect(evaluateLeaveSelection("2030-05-09", "2030-05-13", "FULL_DAY")).toEqual({ valid: true, breakdown: { calendarDays: 5, weekendDays: 2, workingDays: 3, requestedDays: 3 } });
        expect(evaluateLeaveSelection("2030-05-06", "2030-05-10", "FULL_DAY")).toEqual({ valid: true, breakdown: { calendarDays: 5, weekendDays: 0, workingDays: 5, requestedDays: 5 } });
        expect(calculateLeaveDuration("2030-05-11", "2030-05-12", "FULL_DAY")).toBe(0);
        expect(evaluateLeaveSelection("2030-05-11", "2030-05-12", "FULL_DAY").valid).toBe(false);
    });
});
