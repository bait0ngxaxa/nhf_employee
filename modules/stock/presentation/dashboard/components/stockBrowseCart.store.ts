"use client";

import {
    buildStockRequestPayload,
    createPayloadSignature,
    createPendingRequestIdempotency,
    parsePendingIdempotency,
    type PendingRequestIdempotency,
} from "./stockRequestSubmission";
import { normalizeStockProjectCode } from "./stockBrowseCart.shared";
import type {
    BrowseCartItem,
    StockVariantAttributeValueLike,
} from "./stockVariant.shared";

const STOCK_BROWSE_CART_STORAGE_KEY_PREFIX = "stock:browse-cart:v1:user:";
const STOCK_BROWSE_CART_LEGACY_KEY = "stock:browse-cart:v1";

interface PersistedStockBrowseCartState {
    projectCode: string;
    cartItems: PersistedStockBrowseCartItem[];
    pendingIdempotency?: PendingRequestIdempotency | null;
}

interface PersistedStockBrowseCartItem {
    itemId: number;
    itemName: string;
    itemImageUrl: string | null;
    variantId: number;
    variantSku: string;
    variantUnit: string;
    variantImageUrl: string | null;
    variantAvailableQuantity: number;
    variantAttributeValues?: StockVariantAttributeValueLike[];
    qty: number;
}

export type StockBrowseCartSnapshot = {
    cart: Map<number, BrowseCartItem>;
    projectCode: string;
    pendingIdempotency: PendingRequestIdempotency | null;
};

export type StockBrowseCartStore = {
    ensureClientReady: () => void;
    getOrCreatePendingIdempotency: (
        payloadSignature: string,
    ) => PendingRequestIdempotency | null;
    getServerSnapshot: () => StockBrowseCartSnapshot;
    getSnapshot: () => StockBrowseCartSnapshot;
    setEmpty: () => void;
    clearPersisted: () => void;
    subscribe: (listener: () => void) => () => void;
    update: (
        updater: (snapshot: StockBrowseCartSnapshot) => StockBrowseCartSnapshot,
    ) => void;
};

const EMPTY_CART = new Map<number, BrowseCartItem>();
const EMPTY_SNAPSHOT: StockBrowseCartSnapshot = {
    cart: EMPTY_CART,
    projectCode: "",
    pendingIdempotency: null,
};

const stores = new Map<string, StockBrowseCartStore>();

export function getStockBrowseCartStorageKey(
    userId: number | string | null | undefined,
): string | null {
    if (typeof userId === "string") {
        const normalizedUserId = userId.trim();
        return normalizedUserId.length > 0
            ? `${STOCK_BROWSE_CART_STORAGE_KEY_PREFIX}${normalizedUserId}`
            : null;
    }

    if (typeof userId === "number") {
        return `${STOCK_BROWSE_CART_STORAGE_KEY_PREFIX}${userId}`;
    }

    return null;
}

function serializeCartItems(
    cart: ReadonlyMap<number, BrowseCartItem>,
): PersistedStockBrowseCartItem[] {
    return Array.from(cart.values()).map((cartItem) => ({
        itemId: cartItem.item.id,
        itemName: cartItem.item.name,
        itemImageUrl: cartItem.item.imageUrl ?? null,
        variantId: cartItem.variant.id,
        variantSku: cartItem.variant.sku,
        variantUnit: cartItem.variant.unit,
        variantImageUrl: cartItem.variant.imageUrl ?? null,
        variantAvailableQuantity: cartItem.variant.availableQuantity,
        variantAttributeValues: cartItem.variant.attributeValues,
        qty: cartItem.qty,
    }));
}

function isPersistedBrowseCartItem(
    value: unknown,
): value is PersistedStockBrowseCartItem {
    if (!value || typeof value !== "object") {
        return false;
    }

    const maybeItem = value as Record<string, unknown>;
    const maybeQty = maybeItem.qty;
    const itemImageUrl = maybeItem.itemImageUrl;
    const variantImageUrl = maybeItem.variantImageUrl;
    const itemId = maybeItem.itemId;
    const variantId = maybeItem.variantId;
    const variantAvailableQuantity = maybeItem.variantAvailableQuantity;

    if (
        typeof maybeQty !== "number"
        || !Number.isInteger(maybeQty)
        || maybeQty <= 0
    ) {
        return false;
    }
    if (
        typeof itemId !== "number"
        || !Number.isInteger(itemId)
        || itemId <= 0
    ) {
        return false;
    }
    if (
        typeof variantId !== "number"
        || !Number.isInteger(variantId)
        || variantId <= 0
    ) {
        return false;
    }

    return (
        typeof maybeItem.itemName === "string"
        && (
            itemImageUrl === null
            || itemImageUrl === undefined
            || typeof itemImageUrl === "string"
        )
        && typeof maybeItem.variantSku === "string"
        && typeof maybeItem.variantUnit === "string"
        && (
            variantImageUrl === null
            || variantImageUrl === undefined
            || typeof variantImageUrl === "string"
        )
        && typeof variantAvailableQuantity === "number"
        && Number.isFinite(variantAvailableQuantity)
    );
}

function parsePersistedStockBrowseCartState(
    rawValue: string | null,
): PersistedStockBrowseCartState | null {
    if (!rawValue) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        const typedParsed = parsed as Record<string, unknown>;
        const rawProjectCode = typedParsed.projectCode;
        const rawCartItems = typedParsed.cartItems;
        const projectCode = typeof rawProjectCode === "string"
            ? normalizeStockProjectCode(rawProjectCode)
            : "";
        const pendingIdempotency = parsePendingIdempotency(
            typedParsed.pendingIdempotency,
        );

        if (!Array.isArray(rawCartItems)) {
            return { projectCode, cartItems: [], pendingIdempotency };
        }

        return {
            projectCode,
            cartItems: rawCartItems.filter(isPersistedBrowseCartItem),
            pendingIdempotency,
        };
    } catch {
        return null;
    }
}

function readPersistedCart(
    storageKey: string,
): PersistedStockBrowseCartState | null {
    try {
        return parsePersistedStockBrowseCartState(
            window.localStorage.getItem(storageKey),
        );
    } catch {
        return null;
    }
}

function writePersistedCart(
    storageKey: string,
    snapshot: StockBrowseCartSnapshot,
): void {
    try {
        window.localStorage.setItem(
            storageKey,
            JSON.stringify({
                projectCode: snapshot.projectCode,
                cartItems: serializeCartItems(snapshot.cart),
                pendingIdempotency: snapshot.pendingIdempotency,
            } satisfies PersistedStockBrowseCartState),
        );
    } catch {
        // Storage can be unavailable or full; the active in-memory cart still works.
    }
}

function hydrateCartItem(
    persistedCartItem: PersistedStockBrowseCartItem,
): BrowseCartItem {
    return {
        item: {
            id: persistedCartItem.itemId,
            name: persistedCartItem.itemName,
            imageUrl: persistedCartItem.itemImageUrl ?? null,
        },
        variant: {
            id: persistedCartItem.variantId,
            sku: persistedCartItem.variantSku,
            unit: persistedCartItem.variantUnit,
            imageUrl: persistedCartItem.variantImageUrl ?? null,
            availableQuantity: persistedCartItem.variantAvailableQuantity,
            attributeValues: persistedCartItem.variantAttributeValues,
        },
        qty: persistedCartItem.qty,
    };
}

function hydratePersistedCart(
    persistedState: PersistedStockBrowseCartState,
): Map<number, BrowseCartItem> {
    const restoredCart = new Map<number, BrowseCartItem>();

    for (const cartItem of persistedState.cartItems) {
        const hydratedCartItem = hydrateCartItem(cartItem);
        restoredCart.set(hydratedCartItem.variant.id, hydratedCartItem);
    }

    return restoredCart;
}

function createSnapshot(
    cart: Map<number, BrowseCartItem>,
    projectCode: string,
    pendingIdempotency: PendingRequestIdempotency | null,
): StockBrowseCartSnapshot {
    if (cart.size === 0 && projectCode === "" && pendingIdempotency === null) {
        return EMPTY_SNAPSHOT;
    }

    return { cart, projectCode, pendingIdempotency };
}

function buildPersistedSnapshot(
    persistedState: PersistedStockBrowseCartState,
): StockBrowseCartSnapshot {
    const cart = hydratePersistedCart(persistedState);
    const payloadSignature = createPayloadSignature(
        buildStockRequestPayload(persistedState.projectCode, cart),
    );
    const pendingIdempotency = persistedState.pendingIdempotency?.payloadSignature
        === payloadSignature
        ? persistedState.pendingIdempotency
        : null;

    return createSnapshot(
        cart,
        persistedState.projectCode,
        pendingIdempotency,
    );
}

function arePendingIdempotenciesEqual(
    left: PendingRequestIdempotency | null,
    right: PendingRequestIdempotency | null,
): boolean {
    return left?.payloadSignature === right?.payloadSignature
        && left?.key === right?.key;
}

function areCartsEqual(
    left: ReadonlyMap<number, BrowseCartItem>,
    right: ReadonlyMap<number, BrowseCartItem>,
): boolean {
    if (left.size !== right.size) {
        return false;
    }

    for (const [variantId, cartItem] of left) {
        if (right.get(variantId) !== cartItem) {
            return false;
        }
    }

    return true;
}

function areSnapshotsEqual(
    left: StockBrowseCartSnapshot,
    right: StockBrowseCartSnapshot,
): boolean {
    return left.projectCode === right.projectCode
        && arePendingIdempotenciesEqual(
            left.pendingIdempotency,
            right.pendingIdempotency,
        )
        && areCartsEqual(left.cart, right.cart);
}

function createStore(storageKey: string | null): StockBrowseCartStore {
    let clientReady = storageKey === null;
    let snapshot = EMPTY_SNAPSHOT;
    const listeners = new Set<() => void>();
    const notify = (): void => {
        for (const listener of listeners) {
            listener();
        }
    };

    const ensureClientReady = (): void => {
        if (
            clientReady
            || storageKey === null
            || typeof window === "undefined"
        ) {
            return;
        }

        clientReady = true;
        const persistedState = readPersistedCart(storageKey);
        const nextSnapshot = persistedState === null
            ? EMPTY_SNAPSHOT
            : buildPersistedSnapshot(persistedState);

        if (areSnapshotsEqual(snapshot, nextSnapshot)) {
            return;
        }

        snapshot = nextSnapshot;
        notify();
    };

    const getSnapshot = (): StockBrowseCartSnapshot => snapshot;
    const getServerSnapshot = (): StockBrowseCartSnapshot => EMPTY_SNAPSHOT;

    const update = (
        updater: (currentSnapshot: StockBrowseCartSnapshot) => StockBrowseCartSnapshot,
    ): void => {
        if (storageKey === null || typeof window === "undefined") {
            return;
        }

        ensureClientReady();
        const nextSnapshot = updater(snapshot);
        if (areSnapshotsEqual(snapshot, nextSnapshot)) {
            return;
        }

        snapshot = nextSnapshot;
        writePersistedCart(storageKey, snapshot);
        notify();
    };

    const getOrCreatePendingIdempotency = (
        payloadSignature: string,
    ): PendingRequestIdempotency | null => {
        if (storageKey === null || typeof window === "undefined") {
            return null;
        }

        ensureClientReady();
        const currentPending = snapshot.pendingIdempotency;
        if (currentPending?.payloadSignature === payloadSignature) {
            return currentPending;
        }

        const nextPending = createPendingRequestIdempotency(payloadSignature);
        update((currentSnapshot) => ({
            ...currentSnapshot,
            pendingIdempotency: nextPending,
        }));
        return snapshot.pendingIdempotency;
    };

    const setEmpty = (): void => {
        if (storageKey === null || typeof window === "undefined") {
            return;
        }

        ensureClientReady();
        const changed = !areSnapshotsEqual(snapshot, EMPTY_SNAPSHOT);
        snapshot = EMPTY_SNAPSHOT;
        writePersistedCart(storageKey, snapshot);
        if (changed) {
            notify();
        }
    };

    const clearPersisted = (): void => {
        if (storageKey === null || typeof window === "undefined") {
            return;
        }

        clientReady = true;
        const changed = !areSnapshotsEqual(snapshot, EMPTY_SNAPSHOT);
        snapshot = EMPTY_SNAPSHOT;
        try {
            window.localStorage.removeItem(storageKey);
        } catch {
            // Logout must continue even when storage is unavailable.
        }
        if (changed) {
            notify();
        }
    };

    const subscribe = (listener: () => void): (() => void) => {
        ensureClientReady();
        listeners.add(listener);

        return () => {
            listeners.delete(listener);
            if (
                listeners.size === 0
                && storageKey !== null
                && stores.get(storageKey) === store
            ) {
                stores.delete(storageKey);
            }
        };
    };

    const store: StockBrowseCartStore = {
        ensureClientReady,
        getOrCreatePendingIdempotency,
        getServerSnapshot,
        getSnapshot,
        setEmpty,
        clearPersisted,
        subscribe,
        update,
    };

    return store;
}

const anonymousStore = createStore(null);

export function getStockBrowseCartStore(
    storageKey: string | null,
): StockBrowseCartStore {
    if (storageKey === null) {
        return anonymousStore;
    }

    const existingStore = stores.get(storageKey);
    if (existingStore) {
        return existingStore;
    }

    const newStore = createStore(storageKey);
    stores.set(storageKey, newStore);
    return newStore;
}

export function clearStockBrowseCart(userId: string): void {
    if (typeof window === "undefined") {
        return;
    }

    const storageKey = getStockBrowseCartStorageKey(userId);
    if (storageKey !== null) {
        const store = stores.get(storageKey);
        if (store) {
            store.clearPersisted();
        } else {
            try {
                window.localStorage.removeItem(storageKey);
            } catch {
                // Logout must continue even when storage is unavailable.
            }
        }
    }

    try {
        window.localStorage.removeItem(STOCK_BROWSE_CART_LEGACY_KEY);
    } catch {
        // Logout must continue even when storage is unavailable.
    }
}
