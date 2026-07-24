import { createHash } from "node:crypto";
import type {
    TicketIdempotencyOperation,
    TicketMutationIdempotency,
} from "@prisma/client";

import type { CreateTicketData } from "./types";

const IDEMPOTENCY_CONFLICT_MESSAGE =
    "Idempotency-Key นี้ถูกใช้กับคำขออื่นแล้ว";

export class TicketIdempotencyConflictError extends Error {
    constructor() {
        super(IDEMPOTENCY_CONFLICT_MESSAGE);
        this.name = "TicketIdempotencyConflictError";
    }
}

function hashPayload(payload: Record<string, unknown>): string {
    return createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
}

export function createTicketRequestHash(data: CreateTicketData): string {
    return hashPayload({
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
    });
}

export function createTicketCommentRequestHash(
    ticketId: number,
    content: string,
): string {
    return hashPayload({ ticketId, content });
}

export function assertMatchingTicketIdempotency(
    record: TicketMutationIdempotency,
    operation: TicketIdempotencyOperation,
    requestHash: string,
): TicketMutationIdempotency {
    if (
        record.operation !== operation
        || record.requestHash !== requestHash
    ) {
        throw new TicketIdempotencyConflictError();
    }
    return record;
}
