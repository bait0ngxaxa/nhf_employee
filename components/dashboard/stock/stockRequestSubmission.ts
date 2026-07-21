import { useCallback, useRef } from "react";
import type { BrowseCartItem } from "./stockVariant.shared";
import { normalizeStockProjectCode } from "./stockBrowseCart.shared";

export type PendingRequestIdempotency = {
    payloadSignature: string;
    key: string;
};

export type StockRequestPayload = {
    projectCode: string;
    items: Array<{
        itemId: number;
        variantId: number;
        quantity: number;
    }>;
};

function createIdempotencyKey(): string {
    if (typeof globalThis.crypto.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }

    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildStockRequestPayload(
    projectCode: string,
    cart: Map<number, BrowseCartItem>,
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

type StockRequestIdempotencyLifecycle = {
    clear: () => void;
    getOrCreate: (payloadSignature: string) => PendingRequestIdempotency;
    reconcile: (payloadSignature: string) => PendingRequestIdempotency | null;
    restore: (pending: PendingRequestIdempotency | null) => void;
};

export function useStockRequestIdempotency(): StockRequestIdempotencyLifecycle {
    const pendingRef = useRef<PendingRequestIdempotency | null>(null);

    const clear = useCallback((): void => {
        pendingRef.current = null;
    }, []);
    const restore = useCallback(
        (pending: PendingRequestIdempotency | null): void => {
            pendingRef.current = pending;
        },
        [],
    );
    const reconcile = useCallback(
        (payloadSignature: string): PendingRequestIdempotency | null => {
            if (pendingRef.current?.payloadSignature !== payloadSignature) {
                pendingRef.current = null;
            }
            return pendingRef.current;
        },
        [],
    );
    const getOrCreate = useCallback(
        (payloadSignature: string): PendingRequestIdempotency => {
            if (pendingRef.current?.payloadSignature !== payloadSignature) {
                pendingRef.current = {
                    payloadSignature,
                    key: createIdempotencyKey(),
                };
            }
            return pendingRef.current;
        },
        [],
    );

    return { clear, getOrCreate, reconcile, restore };
}
