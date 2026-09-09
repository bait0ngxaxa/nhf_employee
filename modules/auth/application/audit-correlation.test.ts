import { describe, expect, it } from "vitest";

import {
    AUDIT_FAMILY_CORRELATION_LENGTH,
    getAuditFamilyCorrelation,
} from "./audit-correlation";

describe("Audit Auth family correlation", () => {
    it("keeps a deterministic equality correlation without returning the runtime family ID", () => {
        const familyId = "0123456789abcdef0123456789abcdef";

        expect(getAuditFamilyCorrelation(familyId)).toBe("0123456789abcdef");
        expect(getAuditFamilyCorrelation(familyId)).toBe(
            getAuditFamilyCorrelation(familyId),
        );
        expect(getAuditFamilyCorrelation(familyId)).not.toBe(familyId);
        expect(getAuditFamilyCorrelation(familyId)).toHaveLength(
            AUDIT_FAMILY_CORRELATION_LENGTH,
        );
    });

    it("keeps distinct normal family IDs distinct at the selected prefix", () => {
        const firstFamilyId = "0123456789abcdef0000000000000000";
        const secondFamilyId = "fedcba98765432100000000000000000";

        expect(getAuditFamilyCorrelation(firstFamilyId)).not.toBe(
            getAuditFamilyCorrelation(secondFamilyId),
        );
    });

    it("does not persist an unexpected short family ID as raw metadata", () => {
        expect(getAuditFamilyCorrelation("family-1")).toBe("unavailable");
    });
});
