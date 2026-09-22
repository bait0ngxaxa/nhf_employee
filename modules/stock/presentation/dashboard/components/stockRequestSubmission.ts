import type { CreateRequestInput } from "../../../schemas/stock";
import type { BrowseCartItem } from "./stockVariant.shared";
import { normalizeStockProjectCode } from "./stockBrowseCart.shared";

export type PendingRequestIdempotency = {
    payloadSignature: string;
    key: string;
};

export type StockRequestPayload = CreateRequestInput;

function createIdempotencyKey(): string {
    if (typeof globalThis.crypto.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }

    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildStockRequestPayload(
    projectCode: string,
    cart: ReadonlyMap<number, BrowseCartItem>,
): StockRequestPayload {
    return {
        projectCode: normalizeStockProjectCode(projectCode),
        items: Array.from(cart.values()).map((cartItem) => ({
            itemId: cartItem.item.id,
            variantId: cartItem.variant.id,
            quantity: cartItem.qty,
        })),
    };
}

export function createPayloadSignature(payload: StockRequestPayload): string {
    return JSON.stringify(payload);
}

export function parsePendingIdempotency(
    value: unknown,
): PendingRequestIdempotency | null {
    if (!value || typeof value !== "object") {
        return null;
    }

    const pending = value as Record<string, unknown>;
    if (
        typeof pending.payloadSignature !== "string"
        || typeof pending.key !== "string"
        || pending.key.length === 0
        || pending.key.length > 255
    ) {
        return null;
    }

    return {
        payloadSignature: pending.payloadSignature,
        key: pending.key,
    };
}

export function createPendingRequestIdempotency(
    payloadSignature: string,
): PendingRequestIdempotency {
    return {
        payloadSignature,
        key: createIdempotencyKey(),
    };
}
