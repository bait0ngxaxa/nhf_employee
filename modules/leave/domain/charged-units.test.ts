import { describe, expect, it } from "vitest";
import { getEffectiveChargedHalfDays } from "./charged-units";
import { toLeaveRequestDays } from "./half-days";

describe("remaining per-request charged units", () => {
    it.each(["APPROVED", "CANCELLATION_REQUESTED"] as const)("derives legacy %s charges and honors a partial or complete refund", (status) => {
        expect(getEffectiveChargedHalfDays({ status, durationHalfDays: 4, chargedHalfDays: null })).toBe(4);
        expect(getEffectiveChargedHalfDays({ status, durationHalfDays: 4, chargedHalfDays: 2 })).toBe(2);
        expect(getEffectiveChargedHalfDays({ status, durationHalfDays: 4, chargedHalfDays: 0 })).toBe(0);
        expect(getEffectiveChargedHalfDays({ status, durationHalfDays: 4, chargedHalfDays: 6 })).toBe(6);
    });
    it.each(["PENDING", "REJECTED", "CANCELLED", "NOT_TAKEN", "CANCELLED_AFTER_APPROVAL"] as const)("never charges terminal/uncharged %s", (status) => {
        expect(getEffectiveChargedHalfDays({ status, durationHalfDays: 4, chargedHalfDays: null })).toBe(0);
    });
    it.each([-1, 0.5, NaN, Infinity])("rejects invalid remaining charge %s", (chargedHalfDays) => {
        expect(() => getEffectiveChargedHalfDays({ status: "APPROVED", durationHalfDays: 4, chargedHalfDays })).toThrow();
    });
    it("serializes historical duration separately from current effective charge", () => {
        expect(toLeaveRequestDays({ status: "APPROVED", durationHalfDays: 4, chargedHalfDays: 2, overQuotaHalfDays: 0 })).toEqual({ status: "APPROVED", durationDays: 2, chargedDays: 1, overQuotaDays: 0 });
    });
});
