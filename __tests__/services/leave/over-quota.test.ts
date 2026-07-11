import { describe, expect, it } from "vitest";
import { calculateAdditionalOverQuotaDays } from "@/lib/services/leave/over-quota";

describe("calculateAdditionalOverQuotaDays", () => {
    it("counts only the excess introduced by a request when quota is already exceeded", () => {
        expect(calculateAdditionalOverQuotaDays(10, 12, 2)).toBe(2);
    });

    it("counts only the portion beyond the remaining quota", () => {
        expect(calculateAdditionalOverQuotaDays(10, 9, 2)).toBe(1);
    });
});
