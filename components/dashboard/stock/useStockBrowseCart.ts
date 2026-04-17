"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockItem, StockItemVariant } from "../context/stock/types";
import { ensureStockApiSuccess } from "./stockAdminInventory.shared";
import {
    type BrowseCartItem,
    getPreferredVariant,
    getVariantAvailableQuantity,
} from "./stockVariant.shared";

const STOCK_BROWSE_CART_STORAGE_KEY_PREFIX = "stock:browse-cart:v1:user:";

interface PersistedStockBrowseCartState {
    projectCode: string;
    cartItems: PersistedStockBrowseCartItem[];
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
    qty: number;
}

type UseStockBrowseCartParams = {
    userId: number | string | null | undefined;
    onSubmitted: () => void;
};

type UseStockBrowseCartResult = {
    cartCount: number;
    cartItems: BrowseCartItem[];
    cartQuantityByItemId: Map<number, number>;
    cartSize: number;
    projectCode: string;
    recentlyAddedItemId: number | null;
    submitting: boolean;
    addDirectItem: (item: StockItem) => void;
    addVariantToCart: (
        item: StockItem,
        variant: StockItemVariant,
        quantity: number,
    ) => void;
    clearCart: () => void;
    removeFromCart: (variantId: number) => void;
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
        const projectCode = typeof rawProjectCode === "string" ? rawProjectCode : "";

        if (!Array.isArray(rawCartItems)) {
            return { projectCode, cartItems: [] };
        }

        return {
            projectCode,
            cartItems: rawCartItems.filter(isPersistedBrowseCartItem),
        };
    } catch {
        return null;
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

export function useStockBrowseCart({
    userId,
    onSubmitted,
}: UseStockBrowseCartParams): UseStockBrowseCartResult {
    const [cart, setCart] = useState<Map<number, BrowseCartItem>>(new Map());
    const [projectCode, setProjectCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
    const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);

    const storageKey = useMemo(() => buildStorageKey(userId), [userId]);

    useEffect(() => {
        if (!storageKey) {
            setCart(new Map());
            setProjectCode("");
            setHydratedStorageKey(null);
            return;
        }

        const persistedState = parsePersistedStockBrowseCartState(
            window.localStorage.getItem(storageKey),
        );

        if (persistedState) {
            setCart(hydratePersistedCart(persistedState));
            setProjectCode(persistedState.projectCode);
        } else {
            setCart(new Map());
            setProjectCode("");
        }

        setHydratedStorageKey(storageKey);
    }, [storageKey]);

    useEffect(() => {
        if (!storageKey || hydratedStorageKey !== storageKey) {
            return;
        }

        window.localStorage.setItem(
            storageKey,
            JSON.stringify({
                projectCode,
                cartItems: serializeCartItems(cart),
            } satisfies PersistedStockBrowseCartState),
        );
    }, [cart, hydratedStorageKey, projectCode, storageKey]);

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

    function addVariantToCart(
        item: StockItem,
        variant: StockItemVariant,
        quantity: number,
    ): void {
        setCart((prev) => {
            const next = new Map(prev);
            const existing = next.get(variant.id);
            const maxQuantity = getVariantAvailableQuantity(variant);
            const nextQuantity = Math.min(
                maxQuantity,
                (existing?.qty ?? 0) + Math.max(1, quantity),
            );

            next.set(variant.id, {
                item,
                variant,
                qty: nextQuantity,
            });
            return next;
        });
        setRecentlyAddedItemId(item.id);
    }

    function addDirectItem(item: StockItem): void {
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
        setCart(new Map());
        setProjectCode("");
    }

    async function submitRequest(): Promise<void> {
        if (cart.size === 0) {
            return;
        }

        setSubmitting(true);
        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.requests, {
                    projectCode,
                    items: Array.from(cart.values()).map((cartItem) => ({
                        itemId: cartItem.item.id,
                        variantId: cartItem.variant.id,
                        quantity: cartItem.qty,
                    })),
                }),
                "เกิดข้อผิดพลาด",
            );

            toast.success("ส่งคำขอเบิกวัสดุเรียบร้อยแล้ว");
            setCart(new Map());
            setProjectCode("");
            onSubmitted();
        } catch (error: unknown) {
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
        clearCart,
        removeFromCart,
        setProjectCode,
        submitRequest,
        updateCartQuantity,
    };
}
