import { createHash } from "node:crypto";

import type { LeaveRequestValues } from "@/lib/validations/leave";
import type { StoredLeaveAttachment } from "@/lib/uploads/leave";

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
