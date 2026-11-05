import { describe, expect, it } from "vitest";

import {
    calculateEmploymentTenure,
    formatEmploymentHireDate,
    formatEmploymentTenure,
    getThailandDateOnly,
} from "./tenure";

describe("calculateEmploymentTenure", () => {
    it("returns unknown for a null hire date", () => {
        expect(calculateEmploymentTenure(null, "2026-11-04")).toBeNull();
        expect(formatEmploymentTenure(null)).toBe("ยังไม่ทราบ");
    });

    it("returns zero for a known hire date on the as-of date", () => {
        expect(calculateEmploymentTenure("2026-11-04", "2026-11-04")).toEqual({
            years: 0,
            months: 0,
            days: 0,
        });
        expect(formatEmploymentTenure({ years: 0, months: 0, days: 0 })).toBe("0 ปี 0 เดือน 0 วัน");
    });

    it("counts one elapsed day", () => {
        expect(calculateEmploymentTenure("2026-11-04", "2026-11-05")).toEqual({
            years: 0,
            months: 0,
            days: 1,
        });
    });

    it("handles month and year boundaries", () => {
        expect(calculateEmploymentTenure("2026-01-31", "2026-02-28")).toEqual({
            years: 0,
            months: 1,
            days: 0,
        });
        expect(calculateEmploymentTenure("2025-12-31", "2026-01-01")).toEqual({
            years: 0,
            months: 0,
            days: 1,
        });
    });

    it("clamps month-end anniversaries while counting remaining calendar days", () => {
        expect(calculateEmploymentTenure("2023-01-31", "2023-03-01")).toEqual({
            years: 0,
            months: 1,
            days: 1,
        });
    });

    it("handles leap-day anniversaries", () => {
        expect(calculateEmploymentTenure("2020-02-29", "2021-02-28")).toEqual({
            years: 1,
            months: 0,
            days: 0,
        });
        expect(calculateEmploymentTenure("2020-02-29", "2021-03-01")).toEqual({
            years: 1,
            months: 0,
            days: 1,
        });
    });

    it("calculates multiple years, months, and days", () => {
        expect(calculateEmploymentTenure("2023-04-01", "2026-11-04")).toEqual({
            years: 3,
            months: 7,
            days: 3,
        });
    });

    it("uses date-only hire values and the Thailand calendar for instants", () => {
        const hireDate = new Date("2023-04-01T00:00:00.000Z");
        expect(calculateEmploymentTenure(hireDate, "2026-11-04T16:59:59.000Z")).toEqual({
            years: 3,
            months: 7,
            days: 3,
        });
        expect(calculateEmploymentTenure(hireDate, "2026-11-04T17:00:00.000Z")).toEqual({
            years: 3,
            months: 7,
            days: 4,
        });
        expect(getThailandDateOnly(new Date("2026-11-04T16:59:59.999Z"))).toBe("2026-11-04");
        expect(getThailandDateOnly(new Date("2026-11-04T17:00:00.000Z"))).toBe("2026-11-05");
        expect(getThailandDateOnly(new Date("2026-12-31T17:00:00.000Z"))).toBe("2027-01-01");
    });

    it("returns zero instead of negative tenure for future hire dates", () => {
        expect(calculateEmploymentTenure("2026-11-05", "2026-11-04")).toEqual({
            years: 0,
            months: 0,
            days: 0,
        });
    });

    it("returns unknown for invalid date values", () => {
        expect(calculateEmploymentTenure("2026-02-30", "2026-11-04")).toBeNull();
        expect(calculateEmploymentTenure("2023-04-01", "not-a-date")).toBeNull();
    });

    it("formats hire dates with the Thai Buddhist calendar", () => {
        expect(formatEmploymentHireDate("2023-04-01")).toBe("01/04/2566");
        expect(formatEmploymentHireDate(null)).toBe("ไม่ระบุ");
    });
});
