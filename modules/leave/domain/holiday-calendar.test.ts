import { describe, expect, it } from "vitest";
import { calendarMutationSchema, calendarYearSchema, holidayDaySchema, validateHolidayDays } from "./holiday-calendar";

const day = { date: "2026-01-01", name: "วันหยุดทดสอบ", category: "ORGANIZATION", source: "มติองค์กรสำหรับทดสอบ" } as const;

describe("annual holiday calendar validation", () => {
    it("supports Gregorian future years without code changes", () => {
        expect(calendarYearSchema.parse("2027")).toBe(2027);
        expect(calendarYearSchema.parse(2099)).toBe(2099);
        expect(() => validateHolidayDays(2026, [day])).not.toThrow();
    });
    it("rejects duplicate and wrong-year dates", () => {
        expect(() => validateHolidayDays(2026, [day, day])).toThrow("ซ้ำ");
        expect(() => validateHolidayDays(2027, [day])).toThrow("ปี");
    });
    it.each(["2026-02-29", "2026-13-01", "2026-04-31", "2569-1-1", "2026-01-01T00:00:00Z"])("rejects invalid date %s", (date) => {
        expect(holidayDaySchema.safeParse({ ...day, date }).success).toBe(false);
    });
    it("requires a source and explicit verification for publication", () => {
        expect(holidayDaySchema.safeParse({ ...day, source: " " }).success).toBe(false);
        expect(calendarMutationSchema.safeParse({ action: "publish", year: 2026, versionId: "a", revision: 0, expectedActiveVersion: null, confirmEmpty: false, note: "ตรวจสอบแล้ว" }).success).toBe(false);
    });
});
