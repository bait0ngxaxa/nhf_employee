import type { AuditAction } from "@prisma/client";

/**
 * Action-aware read projections for generic audit details.
 *
 * The generic audit API is authorized by `audit.read`, which is a different
 * boundary from the feature that produced the record. Actions whose stored
 * details may contain personal free text (including legacy rows written before
 * the producer was data-minimized) are rebuilt from an allowlist here so the
 * raw values never leave the server. Unregistered actions pass through as-is.
 */
type AuditDetailsRecord = Record<string, unknown>;
type AuditDetailsProjector = (details: AuditDetailsRecord) => AuditDetailsRecord;

const LEAVE_TYPES = new Set(["SICK", "PERSONAL", "VACATION"]);
const LEAVE_PERIODS = new Set(["FULL_DAY", "MORNING", "AFTERNOON"]);
const STATUS_PATTERN = /^[A-Z_]{1,40}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T[0-9:.]+Z)?$/;
const MAX_NAME_LENGTH = 200;

function isRecord(value: unknown): value is AuditDetailsRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSection(details: AuditDetailsRecord, key: string): AuditDetailsRecord {
    const section = details[key];
    return isRecord(section) ? section : {};
}

function matchingText(value: unknown, pattern: RegExp): string | undefined {
    return typeof value === "string" && pattern.test(value) ? value : undefined;
}

function memberText(value: unknown, allowed: ReadonlySet<string>): string | undefined {
    return typeof value === "string" && allowed.has(value) ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boundedText(value: unknown): string | undefined {
    return typeof value === "string" && value.length <= MAX_NAME_LENGTH ? value : undefined;
}

function withoutUndefined(source: Record<string, unknown>): AuditDetailsRecord {
    return Object.fromEntries(
        Object.entries(source).filter(([, value]) => value !== undefined),
    );
}

/** Legacy rows stored the raw reason; reduce it to presence only. */
function hasSpecialReason(section: AuditDetailsRecord): boolean | undefined {
    if (typeof section.hasSpecialReason === "boolean") return section.hasSpecialReason;
    if (!("specialReason" in section)) return undefined;
    return typeof section.specialReason === "string" && section.specialReason.trim().length > 0;
}

function projectSpecialReasonState(section: AuditDetailsRecord): AuditDetailsRecord {
    return withoutUndefined({
        status: matchingText(section.status, STATUS_PATTERN),
        hasSpecialReason: hasSpecialReason(section),
    });
}

function projectLeaveSpecialReasonUpdate(details: AuditDetailsRecord): AuditDetailsRecord {
    const before = projectSpecialReasonState(getSection(details, "before"));
    const after = projectSpecialReasonState(getSection(details, "after"));
    const metadata = getSection(details, "metadata");
    const storedChangeType = memberText(metadata.changeType, new Set(["ADDED", "UPDATED"]));
    const derivedChangeType = typeof before.hasSpecialReason === "boolean"
        ? (before.hasSpecialReason ? "UPDATED" : "ADDED")
        : undefined;

    return {
        before,
        after,
        metadata: withoutUndefined({
            leaveRequestId: matchingText(metadata.leaveRequestId, IDENTIFIER_PATTERN),
            employeeId: finiteNumber(metadata.employeeId),
            employeeName: boundedText(metadata.employeeName),
            leaveType: memberText(metadata.leaveType, LEAVE_TYPES),
            startDate: matchingText(metadata.startDate, ISO_DATE_PATTERN),
            endDate: matchingText(metadata.endDate, ISO_DATE_PATTERN),
            period: memberText(metadata.period, LEAVE_PERIODS),
            durationDays: finiteNumber(metadata.durationDays),
            changedField: "specialReason",
            changeType: storedChangeType ?? derivedChangeType,
        }),
    };
}

const AUDIT_DETAILS_PROJECTORS: Partial<Record<AuditAction, AuditDetailsProjector>> = {
    LEAVE_REQUEST_SPECIAL_REASON_UPDATE: projectLeaveSpecialReasonUpdate,
};

/** Project parsed details for a generic audit read response. */
export function projectAuditDetails(
    action: AuditAction,
    details: Record<string, unknown> | null,
): Record<string, unknown> | null {
    const projector = AUDIT_DETAILS_PROJECTORS[action];
    if (!projector) return details;
    // Fail closed: an unexpected shape for a protected action exposes nothing.
    return isRecord(details) ? projector(details) : null;
}

/** Project serialized details while keeping the raw-row shape for history readers. */
export function projectSerializedAuditDetails(
    action: AuditAction,
    details: string | null,
): string | null {
    if (!AUDIT_DETAILS_PROJECTORS[action] || details === null) return details;
    try {
        const parsed: unknown = JSON.parse(details);
        const projected = projectAuditDetails(action, isRecord(parsed) ? parsed : null);
        return projected === null ? null : JSON.stringify(projected);
    } catch {
        return null;
    }
}
