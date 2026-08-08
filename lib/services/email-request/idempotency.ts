import { createHash } from "node:crypto";

import type { CreateEmailRequestData } from "./types";

const IDEMPOTENCY_CONFLICT_MESSAGE =
    "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว";

export class EmailRequestIdempotencyConflictError extends Error {
    constructor() {
        super(IDEMPOTENCY_CONFLICT_MESSAGE);
        this.name = "EmailRequestIdempotencyConflictError";
    }
}

export function createEmailRequestHash(data: CreateEmailRequestData): string {
    const canonicalPayload = JSON.stringify({
        thaiName: data.thaiName,
        englishName: data.englishName,
        phone: data.phone,
        nickname: data.nickname ?? "",
        position: data.position,
        department: data.department,
        replyEmail: data.replyEmail,
        needsDocumentSystem: data.needsDocumentSystem,
        sharedDriveAccess: [...data.sharedDriveAccess].sort(),
    });

    return createHash("sha256").update(canonicalPayload).digest("hex");
}

export function assertMatchingEmailRequestHash<T extends { requestHash: string }>(
    record: T,
    requestHash: string,
): T {
    if (record.requestHash !== requestHash) {
        throw new EmailRequestIdempotencyConflictError();
    }

    return record;
}
