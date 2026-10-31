import { describe, expect, it } from "vitest";
import { getBuiltInHolidayCalendar } from "./index";
import { validateHolidayDays } from "../holiday-calendar";
import { calculateCalendarLeave } from "../calendar-calculation";

describe("verified BOT annual defaults", () => {
    it.each([
        [2026, "01-01 01-02 03-03 04-06 04-13 04-14 04-15 05-01 05-04 06-01 06-03 07-28 07-29 08-12 10-13 10-23 12-07 12-10 12-31"],
        [2027, "01-01 02-22 04-06 04-13 04-14 04-15 05-03 05-04 05-20 06-03 07-19 07-28 08-12 10-13 10-25 12-06 12-10 12-31"],
    ] as const)("matches the general BOT announcement for %i, including substitutes", (year, dates) => {
        const dataset = getBuiltInHolidayCalendar(year);
        expect(dataset).toBeDefined();
        if (!dataset) throw new Error("Expected verified dataset");
        expect(dataset.days.map((day) => day.date)).toEqual(dates.split(" ").map((day) => `${year}-${day}`));
        expect(() => validateHolidayDays(year, dataset.days)).not.toThrow();
        expect(new Set(dataset.days.map((day) => day.date)).size).toBe(dataset.days.length);
        expect(dataset.days.every((day) => /[ก-๙]/.test(day.name) && day.source === dataset.source)).toBe(true);
        expect(dataset.revision).toBe(`bot-${year}-r1`);
        expect(dataset.source).toContain("app.bot.or.th/");
    });
    it("does not invent future years or treat regional and WFH dates as nationwide holidays", () => {
        expect(getBuiltInHolidayCalendar(2028)).toBeUndefined();
        expect(getBuiltInHolidayCalendar(2026)?.days.map((day) => day.date)).not.toContain("2026-10-16");
        expect(getBuiltInHolidayCalendar(2026)?.exclusions).toEqual(expect.arrayContaining([expect.objectContaining({ date: "2026-10-16" })]));
    });
    it("excludes the verified substitute holiday and rejects half-days on it", () => {
        const holidays = new Set(getBuiltInHolidayCalendar(2027)?.days.map((day) => day.date));
        expect(calculateCalendarLeave("2027-02-19", "2027-02-23", "FULL_DAY", holidays)).toEqual({ durationHalfDays: 4, valid: true });
        for (const period of ["MORNING", "AFTERNOON"] as const) {
            expect(calculateCalendarLeave("2027-02-22", "2027-02-22", period, holidays)).toEqual({ durationHalfDays: 0, valid: false });
        }
    });
    it("returns independent data so callers cannot change future resolutions", () => {
        const dataset = getBuiltInHolidayCalendar(2026);
        dataset?.days.pop();
        expect(getBuiltInHolidayCalendar(2026)?.days).toHaveLength(19);
    });
});
