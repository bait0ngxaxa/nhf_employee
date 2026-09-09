/**
 * The runtime family ID is a 128-bit random Auth session-family identifier.
 * Audit records only need an equality-preserving operational correlation key,
 * not the complete runtime identifier.
 */
export const AUDIT_FAMILY_CORRELATION_LENGTH = 16;

const RUNTIME_FAMILY_ID_PATTERN = /^[0-9a-f]{32}$/;
const UNAVAILABLE_FAMILY_CORRELATION = "unavailable";

export function getAuditFamilyCorrelation(familyId: string): string {
    if (!RUNTIME_FAMILY_ID_PATTERN.test(familyId)) {
        return UNAVAILABLE_FAMILY_CORRELATION;
    }

    return familyId.slice(0, AUDIT_FAMILY_CORRELATION_LENGTH);
}
