import { describe, expect, it } from "vitest";

import {
    daysToHalfDays,
    halfDaysToDays,
    toLeaveQuotaDays,
    toLeaveRequestDays,
} from "@/lib/services/leave/half-days";

describe("leave half-day units", () => {
    it("converts whole and half days without floating-point arithmetic", () => {
        expect(daysToHalfDays(0.5)).toBe(1);
        expect(daysToHalfDays(1)).toBe(2);
        expect(daysToHalfDays(1.5)).toBe(3);
        expect(halfDaysToDays(3)).toBe(1.5);
    });

    it("rejects values outside half-day increments", () => {
        expect(() => daysToHalfDays(0.3)).toThrow(RangeError);
        expect(() => halfDaysToDays(0.5)).toThrow(RangeError);
        expect(() => daysToHalfDays(-0.5)).toThrow(RangeError);
    });

    it("maps persisted quota and request values to day-based API fields", () => {
        expect(toLeaveQuotaDays({
            id: "quota-1",
            totalHalfDays: 12,
            usedHalfDays: 3,
        })).toEqual({
            id: "quota-1",
            totalDays: 6,
            usedDays: 1.5,
        });

        expect(toLeaveRequestDays({
            id: "leave-1",
            durationHalfDays: 1,
            overQuotaHalfDays: 1,
        })).toEqual({
            id: "leave-1",
            durationDays: 0.5,
            overQuotaDays: 0.5,
        });
    });
});
