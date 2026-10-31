import { describe, expect, it } from "vitest";
import { calculateCalendarLeave } from "./calendar-calculation";

describe("calendar-aware integer half-day calculation", () => {
    const holidays = new Set(["2026-11-04", "2026-11-07"]);
    it("excludes an interior holiday and counts no date twice", () => {
        expect(calculateCalendarLeave("2026-11-02", "2026-11-06", "FULL_DAY", holidays)).toEqual({ durationHalfDays: 8, valid: true });
        expect(calculateCalendarLeave("2026-11-06", "2026-11-09", "FULL_DAY", holidays)).toEqual({ durationHalfDays: 4, valid: true });
    });
    it.each(["MORNING", "AFTERNOON"] as const)("supports %s but rejects it on a holiday or weekend", (period) => {
        expect(calculateCalendarLeave("2026-11-02", "2026-11-02", period, holidays)).toEqual({ durationHalfDays: 1, valid: true });
        expect(calculateCalendarLeave("2026-11-04", "2026-11-04", period, holidays)).toEqual({ durationHalfDays: 0, valid: false });
        expect(calculateCalendarLeave("2026-11-07", "2026-11-07", period, holidays).valid).toBe(false);
        expect(calculateCalendarLeave("2026-11-02", "2026-11-03", period, holidays).valid).toBe(false);
    });
    it.each([["2026-11-04", "2026-11-06", 4], ["2026-11-02", "2026-11-04", 4], ["2026-11-07", "2026-11-09", 2]])("rejects nonworking boundaries %s–%s while retaining interior charge for impact", (start, end, units) => {
        expect(calculateCalendarLeave(start, end, "FULL_DAY", holidays)).toEqual({ durationHalfDays: units, valid: false });
    });
    it("rejects cross-year and reversed ranges", () => {
        expect(calculateCalendarLeave("2026-12-31", "2027-01-01", "FULL_DAY", holidays).valid).toBe(false);
        expect(calculateCalendarLeave("2026-11-06", "2026-11-02", "FULL_DAY", holidays).valid).toBe(false);
    });
    it("uses Asia/Bangkok for instants and preserves Gregorian date-only values", () => {
        expect(calculateCalendarLeave(new Date("2026-11-01T18:00:00Z"), "2026-11-02", "FULL_DAY", holidays)).toEqual({ durationHalfDays: 2, valid: true });
    });
});
