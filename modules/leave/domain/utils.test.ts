// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
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
