import { describe, expect, it } from "vitest";

import {
    calculateRoutineOccurrences,
    calendarDateToBangkokStart,
    calendarDayDifference,
    formatRoutineSendTime,
    getDefaultRoutineScheduleConfig,
    getCurrentBangkokDate,
    getRoutineGenerationWindow,
    isRoutineReminderDue,
    parseRoutineSendTime,
    ROUTINE_DEFAULT_REMINDER_TIME,
    ROUTINE_REMINDER_TIME_OPTIONS,
    type RoutineDateWindow,
} from "@/lib/routine/schedule";

const window = (from: string, to: string): RoutineDateWindow => ({ from, to });

describe("NHF Routine schedule engine", () => {
    it("builds fresh defaults from the Bangkok calendar date", () => {
        const today = "2026-08-07";

        expect(getDefaultRoutineScheduleConfig("INTERVAL_MONTHS", today)).toEqual({
            intervalMonths: 3,
            anchorDate: today,
        });
        expect(getDefaultRoutineScheduleConfig("ONE_TIME", today)).toEqual({
            date: today,
        });
        expect(getDefaultRoutineScheduleConfig("YEARLY_DATE", today)).toEqual({
            month: 8,
            day: 7,
        });
        expect(JSON.stringify(getDefaultRoutineScheduleConfig("ONE_TIME", today)))
            .not.toContain("2026-07-21");
    });

    it("does not normalize monthly day 31 into a shorter month", () => {
        const result = calculateRoutineOccurrences(
            { scheduleType: "MONTHLY_DAY", config: { day: 31, monthOffset: 0 } },
            window("2026-02-01", "2026-02-28"),
            "NONE",
        );

        expect(result).toEqual([]);
    });

    it("uses the actual month end for February in leap and non-leap years", () => {
        const leap = calculateRoutineOccurrences(
            { scheduleType: "MONTH_END", config: {} },
            window("2028-02-01", "2028-02-29"),
            "NONE",
        );
        const nonLeap = calculateRoutineOccurrences(
            { scheduleType: "MONTH_END", config: {} },
            window("2027-02-01", "2027-02-28"),
            "NONE",
        );

        expect(leap[0]?.dueDate).toBe("2028-02-29");
        expect(nonLeap[0]?.dueDate).toBe("2027-02-28");
    });

    it("generates interval months from the anchor date", () => {
        const result = calculateRoutineOccurrences(
            {
                scheduleType: "INTERVAL_MONTHS",
                config: { intervalMonths: 3, anchorDate: "2026-01-31" },
            },
            window("2026-01-01", "2026-12-31"),
            "NONE",
        );

        expect(result.map((item) => item.dueDate)).toEqual([
            "2026-01-31",
            "2026-07-31",
            "2026-10-31",
        ]);
    });

    it("supports yearly and one-time schedules", () => {
        const yearly = calculateRoutineOccurrences(
            { scheduleType: "YEARLY_DATE", config: { month: 3, day: 31 } },
            window("2026-01-01", "2027-12-31"),
            "NONE",
        );
        const oneTime = calculateRoutineOccurrences(
            { scheduleType: "ONE_TIME", config: { date: "2026-07-21" } },
            window("2026-07-01", "2026-07-31"),
            "NONE",
        );

        expect(yearly.map((item) => item.dueDate)).toEqual([
            "2026-03-31",
            "2027-03-31",
        ]);
        expect(oneTime[0]?.periodKey).toBe("2026-07-21");
    });

    it("applies month offset and weekend policies", () => {
        const offsetResult = calculateRoutineOccurrences(
            { scheduleType: "MONTHLY_DAY", config: { day: 10, monthOffset: 1 } },
            window("2026-02-01", "2026-02-28"),
            "NONE",
        );
        const previous = calculateRoutineOccurrences(
            { scheduleType: "ONE_TIME", config: { date: "2026-08-08" } },
            window("2026-08-01", "2026-08-31"),
            "PREVIOUS_BUSINESS_DAY",
        );
        const next = calculateRoutineOccurrences(
            { scheduleType: "ONE_TIME", config: { date: "2026-08-08" } },
            window("2026-08-01", "2026-08-31"),
            "NEXT_BUSINESS_DAY",
        );

        expect(offsetResult[0]?.dueDate).toBe("2026-02-10");
        expect(previous[0]?.dueDate).toBe("2026-08-07");
        expect(next[0]?.dueDate).toBe("2026-08-10");
    });

    it("keeps a month-end occurrence when the next business day crosses the target month", () => {
        const result = calculateRoutineOccurrences(
            { scheduleType: "MONTH_END", config: {} },
            window("2026-08-01", "2026-10-31"),
            "NEXT_BUSINESS_DAY",
        );

        expect(result.at(-1)).toEqual({
            periodKey: "2026-10",
            originalDueDate: "2026-10-31",
            dueDate: "2026-11-02",
        });
    });

    it("keeps a day-one occurrence when the previous business day crosses the target month", () => {
        const result = calculateRoutineOccurrences(
            { scheduleType: "MONTHLY_DAY", config: { day: 1, monthOffset: 0 } },
            window("2026-08-01", "2026-08-31"),
            "PREVIOUS_BUSINESS_DAY",
        );

        expect(result).toContainEqual({
            periodKey: "2026-08",
            originalDueDate: "2026-08-01",
            dueDate: "2026-07-31",
        });
    });

    it("keeps yearly, interval, and one-time periods when weekend adjustment crosses a calendar boundary", () => {
        const yearly = calculateRoutineOccurrences(
            { scheduleType: "YEARLY_DATE", config: { month: 12, day: 31 } },
            window("2028-12-01", "2028-12-31"),
            "NEXT_BUSINESS_DAY",
        );
        const interval = calculateRoutineOccurrences(
            {
                scheduleType: "INTERVAL_MONTHS",
                config: { intervalMonths: 1, anchorDate: "2026-10-31" },
            },
            window("2026-10-01", "2026-10-31"),
            "NEXT_BUSINESS_DAY",
        );
        const oneTime = calculateRoutineOccurrences(
            { scheduleType: "ONE_TIME", config: { date: "2026-10-31" } },
            window("2026-10-01", "2026-10-31"),
            "NEXT_BUSINESS_DAY",
        );

        expect(yearly).toContainEqual({
            periodKey: "2028-12",
            originalDueDate: "2028-12-31",
            dueDate: "2029-01-01",
        });
        expect(interval).toContainEqual({
            periodKey: "2026-10",
            originalDueDate: "2026-10-31",
            dueDate: "2026-11-02",
        });
        expect(oneTime).toEqual([{
            periodKey: "2026-10-31",
            originalDueDate: "2026-10-31",
            dueDate: "2026-11-02",
        }]);
    });

    it("does not materialize a period outside the target and business-day margin", () => {
        const result = calculateRoutineOccurrences(
            { scheduleType: "ONE_TIME", config: { date: "2026-11-01" } },
            window("2026-10-01", "2026-10-31"),
            "NEXT_BUSINESS_DAY",
        );

        expect(result).toEqual([]);
    });

    it("keeps calendar calculations in Bangkok time", () => {
        expect(getCurrentBangkokDate(new Date("2026-01-31T17:00:00.000Z"))).toBe(
            "2026-02-01",
        );
        expect(calendarDayDifference("2026-08-01", "2026-08-10")).toBe(9);
        expect(calendarDateToBangkokStart("2026-08-01")).toEqual(
            new Date("2026-07-31T17:00:00.000Z"),
        );
    });

    it("does not generate manual schedules", () => {
        expect(
            calculateRoutineOccurrences(
                { scheduleType: "MANUAL", config: {} },
                window("2026-01-01", "2026-12-31"),
                "NONE",
            ),
        ).toEqual([]);
    });

    it("keeps the baseline generation horizon when no reminder is active", () => {
        expect(
            getRoutineGenerationWindow(new Date("2026-08-04T04:00:00.000Z")),
        ).toEqual({ from: "2026-08-01", to: "2026-10-31" });
    });

    it("extends the generation horizon for a long active reminder", () => {
        expect(
            getRoutineGenerationWindow(new Date("2026-08-04T04:00:00.000Z"), 365),
        ).toEqual({ from: "2026-08-01", to: "2027-08-31" });
    });

    it("evaluates reminder date and send hour in Bangkok time", () => {
        const dueDate = "2026-08-05";

        expect(
            isRoutineReminderDue(
                dueDate,
                2,
                9,
                new Date("2026-08-03T01:59:59.000Z"),
            ),
        ).toBe(false);
        expect(
            isRoutineReminderDue(
                dueDate,
                2,
                9,
                new Date("2026-08-03T02:00:00.000Z"),
            ),
        ).toBe(true);
    });

    it("accepts only full-hour reminder input in HH:mm form", () => {
        expect(ROUTINE_DEFAULT_REMINDER_TIME).toBe("09:00");
        expect(ROUTINE_REMINDER_TIME_OPTIONS).toHaveLength(24);
        expect(ROUTINE_REMINDER_TIME_OPTIONS.map((option) => option.value)).not.toContain("09:30");
        expect(formatRoutineSendTime(0)).toBe("00:00");
        expect(formatRoutineSendTime(9)).toBe("09:00");
        expect(formatRoutineSendTime(23)).toBe("23:00");
        expect(parseRoutineSendTime("00:00")).toBe(0);
        expect(parseRoutineSendTime("09:00")).toBe(9);
        expect(parseRoutineSendTime("23:00")).toBe(23);
        expect(parseRoutineSendTime("09:30")).toBeNull();
        expect(parseRoutineSendTime("24:00")).toBeNull();
        expect(parseRoutineSendTime("9")).toBeNull();
    });
});
