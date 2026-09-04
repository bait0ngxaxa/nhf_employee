import { createHash } from "node:crypto";

import type { LeaveRequestValues } from "@/modules/leave/schemas/leave";
import type { StoredLeaveAttachment } from "@/modules/leave/infrastructure/attachments/storage";

const IDEMPOTENCY_CONFLICT_MESSAGE =
    "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว";

export const LEAVE_REQUEST_IDEMPOTENCY_CONFLICT_CODE =
    "IDEMPOTENCY_CONFLICT" as const;

export class LeaveRequestIdempotencyConflictError extends Error {
    constructor() {
        super(IDEMPOTENCY_CONFLICT_MESSAGE);
        this.name = "LeaveRequestIdempotencyConflictError";
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasIdempotencyFields(value: unknown): boolean {
    if (!Array.isArray(value) || value.length !== 2) {
        return false;
    }

    const fields = value.filter((field): field is string => typeof field === "string");
    return fields.length === 2
        && fields.includes("userId")
        && fields.includes("idempotencyKey");
}

function hasIdempotencyIndex(value: unknown): boolean {
    return typeof value === "string"
        && value.includes("userId")
        && value.includes("idempotencyKey");
}

function hasIdempotencyTarget(value: unknown): boolean {
    return hasIdempotencyFields(value) || hasIdempotencyIndex(value);
}

export function isLeaveRequestIdempotencyConflict(error: unknown): boolean {
    if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) {
        return false;
    }

    const modelName = error.meta.modelName;
    if (
        modelName !== undefined
        && modelName !== "LeaveRequestIdempotency"
    ) {
        return false;
    }

    if (hasIdempotencyTarget(error.meta.target)) {
        return true;
    }

    const driverAdapterError = error.meta.driverAdapterError;
    if (!isRecord(driverAdapterError)) {
        return false;
    }

    const constraint = driverAdapterError.constraint;
    if (!isRecord(constraint)) {
        return false;
    }

    return hasIdempotencyFields(constraint.fields)
        || hasIdempotencyIndex(constraint.index);
}

function canonicalizeAttachments(
    attachments: readonly StoredLeaveAttachment[],
): Array<{
    originalName: string;
    contentType: string;
    contentSha256: string;
}> {
    return attachments.map((attachment) => ({
        originalName: attachment.originalName,
        contentType: attachment.contentType,
        contentSha256: attachment.contentSha256,
    }));
}

export function createLeaveRequestHash(
    payload: LeaveRequestValues,
    attachments: readonly StoredLeaveAttachment[] = [],
): string {
    const canonicalPayload = JSON.stringify({
        leaveType: payload.leaveType,
        startDate: payload.startDate,
        endDate: payload.endDate,
        period: payload.period,
        reason: payload.reason.trim(),
        emergencyReason: payload.emergencyReason?.trim() || null,
        specialReason: payload.specialReason?.trim() || null,
        attachments: canonicalizeAttachments(attachments),
    });

    return createHash("sha256").update(canonicalPayload).digest("hex");
}

export function assertMatchingLeaveRequestHash<T extends { requestHash: string }>(
    record: T,
    requestHash: string,
): T {
    if (record.requestHash !== requestHash) {
        throw new LeaveRequestIdempotencyConflictError();
    }

    return record;
}
