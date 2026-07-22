import { createHash } from "node:crypto";

import type { CreateRequestInput } from "@/lib/validations/stock";

const IDEMPOTENCY_CONFLICT_MESSAGE =
    "Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว";

type CanonicalRequestItem = {
    itemId: number | null;
    variantId: number | null;
    quantity: number;
};

function canonicalizeRequestItems(
    items: CreateRequestInput["items"],
): CanonicalRequestItem[] {
    return items
        .map((item) => ({
            itemId: item.itemId ?? null,
            variantId: item.variantId ?? null,
            quantity: item.quantity,
        }))
        .sort((left, right) => {
            const leftKey = `${left.variantId ?? 0}:${left.itemId ?? 0}`;
            const rightKey = `${right.variantId ?? 0}:${right.itemId ?? 0}`;
            return leftKey.localeCompare(rightKey);
        });
}

export class StockRequestIdempotencyConflictError extends Error {
    constructor() {
        super(IDEMPOTENCY_CONFLICT_MESSAGE);
        this.name = "StockRequestIdempotencyConflictError";
    }
}

export function createStockRequestHash(data: CreateRequestInput): string {
    const canonicalPayload = JSON.stringify({
        projectCode: data.projectCode,
        note: data.note ?? null,
        items: canonicalizeRequestItems(data.items),
    });

    return createHash("sha256").update(canonicalPayload).digest("hex");
}

export function createIdempotencyKeyAuditHash(idempotencyKey: string): string {
    return createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 12);
}

export function assertMatchingRequestHash<T>(
    request: T & { requestHash: string },
    requestHash: string,
): T {
    if (request.requestHash !== requestHash) {
        throw new StockRequestIdempotencyConflictError();
    }

    return request;
}

export function omitStockRequestIdempotency<
    T extends { idempotencyKey: string; requestHash: string },
>(request: T): Omit<T, "idempotencyKey" | "requestHash"> {
    const publicRequest: Partial<T> = { ...request };
    delete publicRequest.idempotencyKey;
    delete publicRequest.requestHash;
    return publicRequest as Omit<T, "idempotencyKey" | "requestHash">;
}
