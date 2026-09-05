import { describe, expect, it } from "vitest";
import { calculateAdditionalOverQuotaDays } from "./over-quota";

describe("calculateAdditionalOverQuotaDays", () => {
    it("counts only the excess introduced by a request when quota is already exceeded", () => {
        expect(calculateAdditionalOverQuotaDays(10, 12, 2)).toBe(2);
    });

    it("counts only the portion beyond the remaining quota", () => {
        expect(calculateAdditionalOverQuotaDays(10, 9, 2)).toBe(1);
    });

    it("counts the full request when effective entitlement is already negative", () => {
        expect(calculateAdditionalOverQuotaDays(-2, 0, 1)).toBe(1);
    });

    it("uses signed positive and negative carry through effective entitlement", () => {
        expect(calculateAdditionalOverQuotaDays(15, 14, 2)).toBe(1);
        expect(calculateAdditionalOverQuotaDays(8, 7, 2)).toBe(1);
    });
});
