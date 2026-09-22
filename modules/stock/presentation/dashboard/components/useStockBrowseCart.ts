"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ensureStockApiSuccess } from "./stockAdminInventory.shared";
import {
    type BrowseCartItem,
    type StockBrowseItem,
    type StockBrowseVariant,
    getPreferredVariant,
    getVariantAvailableQuantity,
} from "./stockVariant.shared";
import { normalizeStockProjectCode } from "./stockBrowseCart.shared";
import {
    buildStockRequestPayload,
    createPayloadSignature,
} from "./stockRequestSubmission";
import {
    getStockBrowseCartStorageKey,
    getStockBrowseCartStore,
    type StockBrowseCartSnapshot,
    type StockBrowseCartStore,
} from "./stockBrowseCart.store";
export { clearStockBrowseCart } from "./stockBrowseCart.store";

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
    canCreateRequests: boolean;
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

function updatePersistedCartState(
    store: StockBrowseCartStore,
    updater: (snapshot: StockBrowseCartSnapshot) => StockBrowseCartSnapshot,
): void {
    store.update((currentSnapshot) => {
        const nextSnapshot = updater(currentSnapshot);
        const payloadSignature = createPayloadSignature(
            buildStockRequestPayload(
                nextSnapshot.projectCode,
                nextSnapshot.cart,
            ),
        );
        const pendingIdempotency = nextSnapshot.pendingIdempotency?.payloadSignature
            === payloadSignature
            ? nextSnapshot.pendingIdempotency
            : null;

        if (pendingIdempotency === nextSnapshot.pendingIdempotency) {
            return nextSnapshot;
        }

        return { ...nextSnapshot, pendingIdempotency };
    });
}

type ActiveSubmission = {
    store: StockBrowseCartStore;
    token: symbol;
};

export function useStockBrowseCart({
    userId,
    canCreateRequests,
    onSubmitted,
    onSubmitError,
    submitRequest: submitRequestTransport = submitDashboardStockRequest,
}: UseStockBrowseCartParams): UseStockBrowseCartResult {
    const storageKey = getStockBrowseCartStorageKey(userId);
    const store = useMemo(
        () => getStockBrowseCartStore(storageKey),
        [storageKey],
    );
    const snapshot = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot,
    );
    const [activeSubmission, setActiveSubmission] =
        useState<ActiveSubmission | null>(null);
    const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<number | null>(null);
    const activeStoreRef = useRef<StockBrowseCartStore>(store);
    const activeSubmissionRef = useRef<ActiveSubmission | null>(null);
    const isCurrentStore = useCallback(
        (): boolean => activeStoreRef.current === store,
        [store],
    );
    const submitting = activeSubmission?.store === store;

    useEffect(() => {
        activeStoreRef.current = store;
    }, [store]);

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
        if (!canCreateRequests || variants.length === 0) {
            return;
        }
        if (!isCurrentStore()) {
            return;
        }

        updatePersistedCartState(store, (currentSnapshot) => {
            const next = new Map(currentSnapshot.cart);

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

            return { ...currentSnapshot, cart: next };
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
        if (!canCreateRequests || !isCurrentStore()) {
            return;
        }
        const defaultVariant = getPreferredVariant(item);
        if (!defaultVariant || getVariantAvailableQuantity(defaultVariant) === 0) {
            toast.error("รายการนี้ไม่มีสต็อกพร้อมเบิก");
            return;
        }

        addVariantToCart(item, defaultVariant, 1);
    }

    function removeFromCart(variantId: number): void {
        if (!canCreateRequests || !isCurrentStore()) {
            return;
        }
        updatePersistedCartState(store, (currentSnapshot) => {
            if (!currentSnapshot.cart.has(variantId)) {
                return currentSnapshot;
            }

            const next = new Map(currentSnapshot.cart);
            next.delete(variantId);
            return { ...currentSnapshot, cart: next };
        });
    }

    function updateCartQuantity(variantId: number, delta: number): void {
        if (!canCreateRequests || !isCurrentStore()) {
            return;
        }
        updatePersistedCartState(store, (currentSnapshot) => {
            const existing = currentSnapshot.cart.get(variantId);

            if (!existing) {
                return currentSnapshot;
            }

            const nextQuantity = Math.min(
                getVariantAvailableQuantity(existing.variant),
                Math.max(0, existing.qty + delta),
            );
            if (nextQuantity === existing.qty) {
                return currentSnapshot;
            }

            const next = new Map(currentSnapshot.cart);

            if (nextQuantity === 0) {
                next.delete(variantId);
                return { ...currentSnapshot, cart: next };
            }

            next.set(variantId, {
                ...existing,
                qty: nextQuantity,
            });
            return { ...currentSnapshot, cart: next };
        });
    }

    function clearCart(): void {
        if (!isCurrentStore()) {
            return;
        }
        store.setEmpty();
    }

    function updateProjectCode(value: string): void {
        if (!isCurrentStore()) {
            return;
        }
        const nextProjectCode = normalizeStockProjectCode(value);
        updatePersistedCartState(store, (currentSnapshot) => {
            if (currentSnapshot.projectCode === nextProjectCode) {
                return currentSnapshot;
            }

            return {
                ...currentSnapshot,
                projectCode: nextProjectCode,
            };
        });
    }

    const reconcileAvailability = useCallback(
        (catalogItems: ReadonlyArray<StockBrowseItem>): StockCartAvailabilityReconciliation => {
            if (!isCurrentStore()) {
                return { changed: false, adjustedCount: 0, removedCount: 0 };
            }
            store.ensureClientReady();
            const outcome = reconcileCartAvailability(
                store.getSnapshot().cart,
                catalogItems,
            );
            if (outcome.result.changed) {
                updatePersistedCartState(store, (currentSnapshot) => ({
                    ...currentSnapshot,
                    cart: outcome.nextCart,
                }));
            }
            return outcome.result;
        },
        [isCurrentStore, store],
    );
    const reconcileVariantAvailability = useCallback(
        (
            variants: ReadonlyArray<StockCartVariantAvailability>,
        ): StockCartAvailabilityReconciliation => {
            if (!isCurrentStore()) {
                return { changed: false, adjustedCount: 0, removedCount: 0 };
            }
            store.ensureClientReady();
            const outcome = reconcileCartVariantAvailability(
                store.getSnapshot().cart,
                variants,
            );
            if (outcome.result.changed) {
                updatePersistedCartState(store, (currentSnapshot) => ({
                    ...currentSnapshot,
                    cart: outcome.nextCart,
                }));
            }
            return outcome.result;
        },
        [isCurrentStore, store],
    );

    async function submitRequest(): Promise<void> {
        if (!canCreateRequests || !isCurrentStore() || submitting) {
            return;
        }

        store.ensureClientReady();
        const currentSnapshot = store.getSnapshot();
        if (currentSnapshot.cart.size === 0) {
            return;
        }

        const normalizedProjectCode = normalizeStockProjectCode(
            currentSnapshot.projectCode,
        );
        if (!normalizedProjectCode) {
            toast.error("กรุณาระบุชื่อย่อโครงการ");
            return;
        }

        const payload = buildStockRequestPayload(
            normalizedProjectCode,
            currentSnapshot.cart,
        );
        const payloadSignature = createPayloadSignature(payload);
        const idempotency = store.getOrCreatePendingIdempotency(payloadSignature);
        if (!idempotency) {
            return;
        }

        const submission = { store, token: Symbol("stock-submission") };
        activeSubmissionRef.current = submission;
        setActiveSubmission(submission);
        try {
            await submitRequestTransport(payload, idempotency.key);

            store.setEmpty();
            if (isCurrentStore()) {
                toast.success("ส่งคำขอเบิกวัสดุเรียบร้อยแล้ว");
                onSubmitted();
            }
        } catch (error: unknown) {
            if (isCurrentStore()) {
                try {
                    await onSubmitError?.(error);
                } catch {
                    // A reconciliation failure must not hide the original mutation error.
                }
                if (isCurrentStore()) {
                    toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
                }
            }
        } finally {
            if (activeSubmissionRef.current?.token === submission.token) {
                activeSubmissionRef.current = null;
                setActiveSubmission(null);
            }
        }
    }

    const hasPendingSubmission = useCallback((): boolean => {
        return isCurrentStore()
            && store.getSnapshot().pendingIdempotency !== null;
    }, [isCurrentStore, store]);
    const cartItems = useMemo(
        () => Array.from(snapshot.cart.values()),
        [snapshot.cart],
    );
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
        cartSize: snapshot.cart.size,
        projectCode: snapshot.projectCode,
        recentlyAddedItemId,
        submitting,
        addDirectItem,
        addVariantToCart,
        addVariantsToCart,
        clearCart,
        hasPendingSubmission,
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
