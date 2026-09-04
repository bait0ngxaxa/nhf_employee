"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ensureStockApiSuccess } from "./stockAdminInventory.shared";
import {
    type BrowseCartItem,
    type StockBrowseItem,
    type StockBrowseVariant,
    type StockVariantAttributeValueLike,
    getPreferredVariant,
    getVariantAvailableQuantity,
} from "./stockVariant.shared";
import { normalizeStockProjectCode } from "./stockBrowseCart.shared";
import {
    buildStockRequestPayload,
    createPayloadSignature,
    parsePendingIdempotency,
    type PendingRequestIdempotency,
    useStockRequestIdempotency,
} from "./stockRequestSubmission";

const STOCK_BROWSE_CART_STORAGE_KEY_PREFIX = "stock:browse-cart:v1:user:";
const STOCK_BROWSE_CART_LEGACY_KEY = "stock:browse-cart:v1";

export function clearStockBrowseCart(userId: string): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (userId.trim().length > 0) {
            window.localStorage.removeItem(
                `${STOCK_BROWSE_CART_STORAGE_KEY_PREFIX}${userId.trim()}`,
            );
        }
        window.localStorage.removeItem(STOCK_BROWSE_CART_LEGACY_KEY);
    } catch {
        // Logout must continue even when storage is unavailable.
    }
}

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

export type StockCartAvailabilityReconciliation = {
    changed: boolean;
    adjustedCount: number;
    removedCount: number;
};

export type StockCartVariantAvailability = {
    id: number;
    availableQuantity: number;
};

type CartAvailabilityReconciliationOutcome = {
    nextCart: Map<number, BrowseCartItem>;
    result: StockCartAvailabilityReconciliation;
};

type UseStockBrowseCartParams = {
    userId: number | string | null | undefined;
    onSubmitted: () => void;
    onSubmitError?: (error: unknown) => void | Promise<void>;
    submitRequest?: StockRequestSubmitter;
};

export type StockRequestSubmitter = (
    payload: ReturnType<typeof buildStockRequestPayload>,
    idempotencyKey: string,
) => Promise<void>;

type UseStockBrowseCartResult = {
    cartCount: number;
    cartItems: BrowseCartItem[];
    cartQuantityByItemId: Map<number, number>;
    cartSize: number;
    projectCode: string;
    recentlyAddedItemId: number | null;
    submitting: boolean;
    addDirectItem: (item: StockBrowseItem) => void;
    addVariantToCart: (
        item: StockBrowseItem,
        variant: StockBrowseVariant,
        quantity: number,
    ) => void;
    addVariantsToCart: (
        item: StockBrowseItem,
        variants: ReadonlyArray<{
            variant: StockBrowseVariant;
            quantity: number;
        }>,
    ) => void;
    clearCart: () => void;
    hasPendingSubmission: () => boolean;
    removeFromCart: (variantId: number) => void;
    reconcileAvailability: (
        catalogItems: ReadonlyArray<StockBrowseItem>,
    ) => StockCartAvailabilityReconciliation;
    reconcileVariantAvailability: (
        variants: ReadonlyArray<StockCartVariantAvailability>,
    ) => StockCartAvailabilityReconciliation;
    setProjectCode: (value: string) => void;
    submitRequest: () => Promise<void>;
    updateCartQuantity: (variantId: number, delta: number) => void;
};

function buildStorageKey(userId: UseStockBrowseCartParams["userId"]): string | null {
    if (typeof userId === "string" && userId.trim().length > 0) {
        return `${STOCK_BROWSE_CART_STORAGE_KEY_PREFIX}${userId}`;
    }
    if (typeof userId === "number") {
        return `${STOCK_BROWSE_CART_STORAGE_KEY_PREFIX}${userId}`;
    }
    return null;
}

function serializeCartItems(
    cart: Map<number, BrowseCartItem>,
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

    if (typeof maybeQty !== "number" || !Number.isInteger(maybeQty) || maybeQty <= 0) {
        return false;
    }
    if (typeof itemId !== "number" || !Number.isInteger(itemId) || itemId <= 0) {
        return false;
    }
    if (typeof variantId !== "number" || !Number.isInteger(variantId) || variantId <= 0) {
        return false;
    }

    return (
        typeof maybeItem.itemName === "string"
        && (itemImageUrl === null || itemImageUrl === undefined || typeof itemImageUrl === "string")
        && typeof maybeItem.variantSku === "string"
        && typeof maybeItem.variantUnit === "string"
        && (variantImageUrl === null || variantImageUrl === undefined || typeof variantImageUrl === "string")
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

function readPersistedCart(storageKey: string): PersistedStockBrowseCartState | null {
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
    state: PersistedStockBrowseCartState,
): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
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

function buildCartQuantityByItemId(
    cartItems: BrowseCartItem[],
): Map<number, number> {
    const quantityByItemId = new Map<number, number>();

    for (const cartItem of cartItems) {
        quantityByItemId.set(
            cartItem.item.id,
            (quantityByItemId.get(cartItem.item.id) ?? 0) + cartItem.qty,
        );
    }

    return quantityByItemId;
}

function reconcileCartVariantAvailability(
    cart: Map<number, BrowseCartItem>,
    variants: ReadonlyArray<StockCartVariantAvailability>,
): CartAvailabilityReconciliationOutcome {
    const availabilityByVariantId = new Map<number, number>();
    for (const variant of variants) {
        if (Number.isFinite(variant.availableQuantity)) {
            availabilityByVariantId.set(
                variant.id,
                Math.max(0, variant.availableQuantity),
            );
        }
    }

    let nextCart = cart;
    let changed = false;
    let adjustedCount = 0;
    let removedCount = 0;

    for (const cartItem of cart.values()) {
        const latestAvailableQuantity = availabilityByVariantId.get(
            cartItem.variant.id,
        );
        if (latestAvailableQuantity === undefined) {
            continue;
        }

        if (latestAvailableQuantity === 0) {
            if (!changed) nextCart = new Map(cart);
            nextCart.delete(cartItem.variant.id);
            changed = true;
            removedCount += 1;
            continue;
        }

        const nextQuantity = Math.min(cartItem.qty, latestAvailableQuantity);
        if (
            cartItem.variant.availableQuantity === latestAvailableQuantity
            && cartItem.qty === nextQuantity
        ) {
            continue;
        }

        if (!changed) nextCart = new Map(cart);
        nextCart.set(cartItem.variant.id, {
            ...cartItem,
            variant: {
                ...cartItem.variant,
                availableQuantity: latestAvailableQuantity,
            },
            qty: nextQuantity,
        });
        changed = true;
        if (cartItem.qty !== nextQuantity) {
            adjustedCount += 1;
        }
    }

    return {
        nextCart,
        result: { changed, adjustedCount, removedCount },
    };
}

function reconcileCartAvailability(
    cart: Map<number, BrowseCartItem>,
    catalogItems: ReadonlyArray<StockBrowseItem>,
): CartAvailabilityReconciliationOutcome {
    const variants: StockCartVariantAvailability[] = [];
    for (const catalogItem of catalogItems) {
        for (const variant of catalogItem.variants ?? []) {
            variants.push({
                id: variant.id,
                availableQuantity: variant.availableQuantity,
            });
        }
    }

    return reconcileCartVariantAvailability(cart, variants);
}

export function useStockBrowseCart({
    userId,
    onSubmitted,
    onSubmitError,
    submitRequest: submitRequestTransport = submitDashboardStockRequest,
}: UseStockBrowseCartParams): UseStockBrowseCartResult {
    const [cart, setCart] = useState<Map<number, BrowseCartItem>>(new Map());
    const [projectCode, setProjectCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
    const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
    const {
        clear: clearIdempotency,
        getOrCreate: getOrCreateIdempotency,
        hasPending: hasPendingIdempotency,
        reconcile: reconcileIdempotency,
        restore: restoreIdempotency,
    } = useStockRequestIdempotency();

    const storageKey = useMemo(() => buildStorageKey(userId), [userId]);

    useEffect(() => {
        if (!storageKey) {
            restoreIdempotency(null);
            setCart(new Map());
            setProjectCode("");
            setHydratedStorageKey(null);
            return;
        }

        const persistedState = readPersistedCart(storageKey);

        if (persistedState) {
            restoreIdempotency(persistedState.pendingIdempotency ?? null);
            setCart(hydratePersistedCart(persistedState));
            setProjectCode(persistedState.projectCode);
        } else {
            restoreIdempotency(null);
            setCart(new Map());
            setProjectCode("");
        }

        setHydratedStorageKey(storageKey);
    }, [restoreIdempotency, storageKey]);

    useEffect(() => {
        if (!storageKey || hydratedStorageKey !== storageKey) {
            return;
        }

        const payloadSignature = createPayloadSignature(
            buildStockRequestPayload(projectCode, cart),
        );
        const currentIdempotency = reconcileIdempotency(payloadSignature);

        writePersistedCart(storageKey, {
            projectCode,
            cartItems: serializeCartItems(cart),
            pendingIdempotency: currentIdempotency,
        });
    }, [
        cart,
        hydratedStorageKey,
        projectCode,
        reconcileIdempotency,
        storageKey,
    ]);

    useEffect(() => {
        if (recentlyAddedItemId === null) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setRecentlyAddedItemId(null);
        }, 1100);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [recentlyAddedItemId]);

    function addVariantsToCart(
        item: StockBrowseItem,
        variants: ReadonlyArray<{
            variant: StockBrowseVariant;
            quantity: number;
        }>,
    ): void {
        if (variants.length === 0) {
            return;
        }

        setCart((prev) => {
            const next = new Map(prev);

            for (const entry of variants) {
                if (entry.quantity <= 0) {
                    continue;
                }

                const existing = next.get(entry.variant.id);
                const maxQuantity = getVariantAvailableQuantity(entry.variant);
                const nextQuantity = Math.min(
                    maxQuantity,
                    (existing?.qty ?? 0) + Math.max(1, entry.quantity),
                );

                if (nextQuantity === 0) {
                    next.delete(entry.variant.id);
                    continue;
                }

                next.set(entry.variant.id, {
                    item,
                    variant: entry.variant,
                    qty: nextQuantity,
                });
            }

            return next;
        });
        setRecentlyAddedItemId(item.id);
    }

    function addVariantToCart(
        item: StockBrowseItem,
        variant: StockBrowseVariant,
        quantity: number,
    ): void {
        addVariantsToCart(item, [{ variant, quantity }]);
    }

    function addDirectItem(item: StockBrowseItem): void {
        const defaultVariant = getPreferredVariant(item);
        if (!defaultVariant || getVariantAvailableQuantity(defaultVariant) === 0) {
            toast.error("รายการนี้ไม่มีสต็อกพร้อมเบิก");
            return;
        }

        addVariantToCart(item, defaultVariant, 1);
    }

    function removeFromCart(variantId: number): void {
        setCart((prev) => {
            const next = new Map(prev);
            next.delete(variantId);
            return next;
        });
    }

    function updateCartQuantity(variantId: number, delta: number): void {
        setCart((prev) => {
            const next = new Map(prev);
            const existing = next.get(variantId);

            if (!existing) {
                return prev;
            }

            const nextQuantity = Math.min(
                getVariantAvailableQuantity(existing.variant),
                Math.max(0, existing.qty + delta),
            );

            if (nextQuantity === 0) {
                next.delete(variantId);
                return next;
            }

            next.set(variantId, {
                ...existing,
                qty: nextQuantity,
            });
            return next;
        });
    }

    function clearCart(): void {
        clearIdempotency();
        setCart(new Map());
        setProjectCode("");
    }

    function updateProjectCode(value: string): void {
        setProjectCode(normalizeStockProjectCode(value));
    }

    const reconcileAvailability = useCallback(
        (catalogItems: ReadonlyArray<StockBrowseItem>): StockCartAvailabilityReconciliation => {
            const outcome = reconcileCartAvailability(cart, catalogItems);
            if (outcome.result.changed) {
                setCart(outcome.nextCart);
            }
            return outcome.result;
        },
        [cart],
    );
    const reconcileVariantAvailability = useCallback(
        (
            variants: ReadonlyArray<StockCartVariantAvailability>,
        ): StockCartAvailabilityReconciliation => {
            const outcome = reconcileCartVariantAvailability(cart, variants);
            if (outcome.result.changed) {
                setCart(outcome.nextCart);
            }
            return outcome.result;
        },
        [cart],
    );

    async function submitRequest(): Promise<void> {
        if (submitting) {
            return;
        }

        if (cart.size === 0) {
            return;
        }

        const normalizedProjectCode = normalizeStockProjectCode(projectCode);
        if (!normalizedProjectCode) {
            toast.error("กรุณาระบุชื่อย่อโครงการ");
            return;
        }

        const payload = buildStockRequestPayload(normalizedProjectCode, cart);
        const payloadSignature = createPayloadSignature(payload);
        const idempotency = getOrCreateIdempotency(payloadSignature);
        if (storageKey) {
            writePersistedCart(storageKey, {
                projectCode,
                cartItems: serializeCartItems(cart),
                pendingIdempotency: idempotency,
            });
        }

        setSubmitting(true);
        try {
            await submitRequestTransport(payload, idempotency.key);

            clearIdempotency();
            if (storageKey) {
                writePersistedCart(storageKey, {
                    projectCode: "",
                    cartItems: [],
                    pendingIdempotency: null,
                });
            }
            toast.success("ส่งคำขอเบิกวัสดุเรียบร้อยแล้ว");
            setCart(new Map());
            setProjectCode("");
            onSubmitted();
        } catch (error: unknown) {
            try {
                await onSubmitError?.(error);
            } catch {
                // A reconciliation failure must not hide the original mutation error.
            }
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setSubmitting(false);
        }
    }

    const cartItems = useMemo(() => Array.from(cart.values()), [cart]);
    const cartCount = useMemo(
        () => cartItems.reduce((sum, cartItem) => sum + cartItem.qty, 0),
        [cartItems],
    );
    const cartQuantityByItemId = useMemo(
        () => buildCartQuantityByItemId(cartItems),
        [cartItems],
    );

    return {
        cartCount,
        cartItems,
        cartQuantityByItemId,
        cartSize: cart.size,
        projectCode,
        recentlyAddedItemId,
        submitting,
        addDirectItem,
        addVariantToCart,
        addVariantsToCart,
        clearCart,
        hasPendingSubmission: hasPendingIdempotency,
        removeFromCart,
        reconcileAvailability,
        reconcileVariantAvailability,
        setProjectCode: updateProjectCode,
        submitRequest,
        updateCartQuantity,
    };
}

async function submitDashboardStockRequest(
    payload: ReturnType<typeof buildStockRequestPayload>,
    idempotencyKey: string,
): Promise<void> {
    ensureStockApiSuccess(
        await apiPost(API_ROUTES.stock.requests, payload, {
            headers: { "Idempotency-Key": idempotencyKey },
        }),
        "เกิดข้อผิดพลาด",
    );
}
