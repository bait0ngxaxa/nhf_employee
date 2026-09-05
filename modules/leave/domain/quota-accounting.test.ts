import { describe, expect, it } from "vitest";

import {
    calculateCarryBalanceForNextYear,
    calculateClosingBalanceHalfDays,
    calculateEffectiveEntitlementHalfDays,
    calculateOpeningCarryBalanceHalfDays,
    calculateRemainingBalanceHalfDays,
} from "./quota-accounting";

describe("leave quota accounting", () => {
    it("calculates positive, zero, and negative effective entitlements", () => {
        expect(calculateEffectiveEntitlementHalfDays(20, 14)).toBe(34);
        expect(calculateEffectiveEntitlementHalfDays(20, -20)).toBe(0);
        expect(calculateEffectiveEntitlementHalfDays(20, -24)).toBe(-4);
    });

    it("calculates positive and negative remaining balances", () => {
        expect(calculateRemainingBalanceHalfDays(20, 14, 10)).toBe(24);
        expect(calculateRemainingBalanceHalfDays(20, -4, 18)).toBe(-2);
        expect(calculateClosingBalanceHalfDays(20, 0, 19)).toBe(1);
        expect(calculateClosingBalanceHalfDays(20, 0, 21)).toBe(-1);
    });

    it("resets both unused balance and debt for sick leave", () => {
        expect(calculateCarryBalanceForNextYear("SICK", 60, 0, 40)).toBe(0);
        expect(calculateCarryBalanceForNextYear("SICK", 60, 0, 70)).toBe(0);
    });

    it("carries positive and negative personal balances", () => {
        expect(calculateCarryBalanceForNextYear("PERSONAL", 20, 0, 6)).toBe(14);
        expect(calculateCarryBalanceForNextYear("PERSONAL", 20, 0, 24)).toBe(-4);
    });

    it("carries positive and negative vacation balances", () => {
        expect(calculateCarryBalanceForNextYear("VACATION", 12, 0, 8)).toBe(4);
        expect(calculateCarryBalanceForNextYear("VACATION", 12, 0, 16)).toBe(-4);
    });

    it("accumulates positive carry across multiple years", () => {
        const carry2027 = calculateCarryBalanceForNextYear(
            "PERSONAL",
            20,
            0,
            6,
        );
        const carry2028 = calculateCarryBalanceForNextYear(
            "PERSONAL",
            20,
            carry2027,
            10,
        );

        expect(carry2027).toBe(14);
        expect(carry2028).toBe(24);
        expect(calculateEffectiveEntitlementHalfDays(20, carry2028)).toBe(44);
    });

    it("preserves debt across multiple years", () => {
        const carry2027 = calculateCarryBalanceForNextYear(
            "PERSONAL",
            20,
            0,
            28,
        );
        const carry2028 = calculateCarryBalanceForNextYear(
            "PERSONAL",
            20,
            carry2027,
            16,
        );

        expect(carry2027).toBe(-8);
        expect(carry2028).toBe(-4);
        expect(calculateEffectiveEntitlementHalfDays(20, carry2028)).toBe(16);
    });

    it("accounts for annual entitlement in missing intermediate years", () => {
        expect(calculateOpeningCarryBalanceHalfDays({
            leaveType: "PERSONAL",
            totalHalfDays: 20,
            targetYear: 2028,
            previousQuota: {
                year: 2026,
                carryBalanceHalfDays: 0,
                usedHalfDays: 12,
            },
        })).toBe(28);
    });

    it("keeps half-day carry exact for both credit and debt", () => {
        expect(calculateCarryBalanceForNextYear("PERSONAL", 20, 0, 19)).toBe(1);
        expect(calculateCarryBalanceForNextYear("PERSONAL", 20, 0, 21)).toBe(-1);
    });

    it("rejects unsafe integer inputs", () => {
        expect(() => calculateEffectiveEntitlementHalfDays(
            20,
            Number.MAX_SAFE_INTEGER + 1,
        )).toThrow(RangeError);
    });
});
