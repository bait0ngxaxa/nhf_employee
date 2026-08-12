import { describe, expect, it } from "vitest";

import {
    daysToHalfDays,
    halfDaysToDays,
    signedHalfDaysToDays,
    toLeaveQuotaDays,
    toLeaveRequestDays,
} from "@/lib/services/leave/half-days";

describe("leave half-day units", () => {
    it("converts whole and half days without floating-point arithmetic", () => {
        expect(daysToHalfDays(0.5)).toBe(1);
        expect(daysToHalfDays(1)).toBe(2);
        expect(daysToHalfDays(1.5)).toBe(3);
        expect(halfDaysToDays(3)).toBe(1.5);
        expect(signedHalfDaysToDays(-3)).toBe(-1.5);
    });

    it("rejects values outside half-day increments", () => {
        expect(() => daysToHalfDays(0.3)).toThrow(RangeError);
        expect(() => halfDaysToDays(0.5)).toThrow(RangeError);
        expect(() => daysToHalfDays(-0.5)).toThrow(RangeError);
        expect(() => signedHalfDaysToDays(Number.MAX_SAFE_INTEGER + 1)).toThrow(
            RangeError,
        );
    });

    it("maps persisted quota and request values to day-based API fields", () => {
        expect(toLeaveQuotaDays({
            id: "quota-1",
            totalHalfDays: 12,
            carryBalanceHalfDays: -3,
            usedHalfDays: 3,
        })).toEqual({
            id: "quota-1",
            totalDays: 6,
            carryBalanceDays: -1.5,
            effectiveTotalDays: 4.5,
            usedDays: 1.5,
            remainingDays: 3,
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

    it("serializes positive carry and half-day balances", () => {
        expect(toLeaveQuotaDays({
            leaveType: "PERSONAL",
            totalHalfDays: 20,
            carryBalanceHalfDays: 1,
            usedHalfDays: 19,
        })).toEqual({
            leaveType: "PERSONAL",
            totalDays: 10,
            carryBalanceDays: 0.5,
            effectiveTotalDays: 10.5,
            usedDays: 9.5,
            remainingDays: 1,
        });
    });

    it("serializes negative effective entitlement and remaining debt", () => {
        expect(toLeaveQuotaDays({
            leaveType: "PERSONAL",
            totalHalfDays: 20,
            carryBalanceHalfDays: -24,
            usedHalfDays: 1,
        })).toEqual({
            leaveType: "PERSONAL",
            totalDays: 10,
            carryBalanceDays: -12,
            effectiveTotalDays: -2,
            usedDays: 0.5,
            remainingDays: -2.5,
        });
    });
});
