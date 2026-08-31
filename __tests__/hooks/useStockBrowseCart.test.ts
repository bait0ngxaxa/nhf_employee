import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    useStockBrowseCart,
    type StockCartAvailabilityReconciliation,
} from "@/components/dashboard/stock/useStockBrowseCart";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

vi.mock("@/lib/client/api-client", () => ({
    apiPost: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("useStockBrowseCart idempotency", () => {
    const storageKey = "stock:browse-cart:v1:user:7";
    const payload = {
        projectCode: "PRJ-2569/01",
        items: [{ itemId: 10, variantId: 101, quantity: 2 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        vi.mocked(apiPost).mockResolvedValue({
            success: true,
            data: {},
            status: 201,
            requestId: "request-id",
        });
    });

    it("reuses the persisted key after remounting an unconfirmed request", async () => {
        window.localStorage.setItem(storageKey, JSON.stringify({
            projectCode: payload.projectCode,
            cartItems: [{
                itemId: 10,
                itemName: "กระดาษ",
                itemImageUrl: null,
                variantId: 101,
                variantSku: "PAPER-A4",
                variantUnit: "รีม",
                variantImageUrl: null,
                variantAvailableQuantity: 20,
                qty: 2,
            }],
            pendingIdempotency: {
                payloadSignature: JSON.stringify(payload),
                key: "persisted-stock-request-key",
            },
        }));
        const onSubmitted = vi.fn();
        const { result } = renderHook(() =>
            useStockBrowseCart({ userId: 7, onSubmitted }),
        );

        await waitFor(() => {
            expect(result.current.cartSize).toBe(1);
        });

        await act(async () => {
            await result.current.submitRequest();
        });

        expect(apiPost).toHaveBeenCalledWith(
            API_ROUTES.stock.requests,
            payload,
            {
                headers: {
                    "Idempotency-Key": "persisted-stock-request-key",
                },
            },
        );
        expect(onSubmitted).toHaveBeenCalledTimes(1);
        expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")).toEqual({
            projectCode: "",
            cartItems: [],
            pendingIdempotency: null,
        });
    });

    it("supports shared cart operations and keeps storage scoped per user", async () => {
        const item = {
            id: 10,
            name: "กระดาษ",
            imageUrl: null,
            variants: [{
                id: 101,
                sku: "PAPER-A4",
                unit: "รีม",
                imageUrl: null,
                availableQuantity: 3,
                attributeValues: [],
            }],
        };
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted: vi.fn(),
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(0));
        act(() => {
            result.current.addDirectItem(item);
            result.current.setProjectCode(" nhf 2569 ");
        });
        expect(result.current.cartCount).toBe(1);
        expect(result.current.projectCode).toBe("NHF2569");

        act(() => {
            result.current.updateCartQuantity(101, 10);
        });
        expect(result.current.cartCount).toBe(3);

        await waitFor(() => {
            expect(window.localStorage.getItem(storageKey)).not.toBeNull();
        });
        expect(window.localStorage.getItem("stock:browse-cart:v1:user:8")).toBeNull();

        act(() => result.current.removeFromCart(101));
        expect(result.current.cartSize).toBe(0);
        act(() => {
            result.current.addDirectItem(item);
            result.current.clearCart();
        });
        expect(result.current.cartSize).toBe(0);
        expect(result.current.projectCode).toBe("");
    });

    it("retains retry state after failure and clears it only after success", async () => {
        window.localStorage.setItem(storageKey, JSON.stringify({
            projectCode: payload.projectCode,
            cartItems: [{
                itemId: 10,
                itemName: "กระดาษ",
                itemImageUrl: null,
                variantId: 101,
                variantSku: "PAPER-A4",
                variantUnit: "รีม",
                variantImageUrl: null,
                variantAvailableQuantity: 20,
                qty: 2,
            }],
            pendingIdempotency: null,
        }));
        const submitTransport = vi.fn()
            .mockRejectedValueOnce(new Error("network unavailable"))
            .mockResolvedValueOnce(undefined);
        const onSubmitted = vi.fn();
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted,
            submitRequest: submitTransport,
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(1));
        await act(async () => result.current.submitRequest());
        const retryKey = submitTransport.mock.calls[0]?.[1] as string;
        expect(retryKey).toBeTruthy();
        expect(result.current.cartSize).toBe(1);
        expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}"))
            .toMatchObject({
                pendingIdempotency: { key: retryKey },
                cartItems: [{ qty: 2 }],
            });

        await act(async () => result.current.submitRequest());
        expect(submitTransport.mock.calls[1]?.[1]).toBe(retryKey);
        expect(onSubmitted).toHaveBeenCalledTimes(1);
        expect(result.current.cartSize).toBe(0);
        expect(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}"))
            .toEqual({
                projectCode: "",
                cartItems: [],
                pendingIdempotency: null,
            });
    });

    it("uses a new idempotency key after availability reconciliation changes the payload", async () => {
        const item = {
            id: 10,
            name: "กระดาษ",
            imageUrl: null,
            variants: [{
                id: 101,
                sku: "PAPER-A4",
                unit: "รีม",
                imageUrl: null,
                availableQuantity: 10,
                attributeValues: [],
            }],
        };
        const latestCatalog = [{
            ...item,
            variants: [{ ...item.variants[0], availableQuantity: 4 }],
        }];
        const submitTransport = vi.fn()
            .mockRejectedValueOnce(new Error("Stock conflict"))
            .mockResolvedValueOnce(undefined);
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted: vi.fn(),
            submitRequest: submitTransport,
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(0));
        act(() => {
            result.current.addVariantToCart(item, item.variants[0], 8);
            result.current.setProjectCode("NHF-2569");
        });

        await act(async () => result.current.submitRequest());
        const firstKey = submitTransport.mock.calls[0]?.[1] as string;
        expect(firstKey).toBeTruthy();

        let reconciliation: StockCartAvailabilityReconciliation | null = null;
        act(() => {
            reconciliation = result.current.reconcileAvailability(latestCatalog);
        });
        expect(reconciliation).toEqual({
            changed: true,
            adjustedCount: 1,
            removedCount: 0,
        });
        await waitFor(() => expect(result.current.cartItems[0]?.qty).toBe(4));

        await act(async () => result.current.submitRequest());
        const secondKey = submitTransport.mock.calls[1]?.[1] as string;
        expect(secondKey).toBeTruthy();
        expect(secondKey).not.toBe(firstKey);
    });
});

describe("useStockBrowseCart availability reconciliation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    const item = {
        id: 10,
        name: "กระดาษ",
        imageUrl: null,
        variants: [{
            id: 101,
            sku: "PAPER-A4",
            unit: "รีม",
            imageUrl: null,
            availableQuantity: 10,
            attributeValues: [],
        }],
    };

    it("clamps quantity when latest availability decreases but remains positive", async () => {
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted: vi.fn(),
        }));
        await waitFor(() => expect(result.current.cartSize).toBe(0));

        act(() => result.current.addVariantToCart(item, item.variants[0], 8));
        let reconciliation: StockCartAvailabilityReconciliation | null = null;
        act(() => {
            reconciliation = result.current.reconcileAvailability([{
                ...item,
                variants: [{ ...item.variants[0], availableQuantity: 4 }],
            }]);
        });

        expect(result.current.cartItems).toMatchObject([{
            qty: 4,
            variant: { id: 101, availableQuantity: 4 },
        }]);
        expect(reconciliation).toEqual({
            changed: true,
            adjustedCount: 1,
            removedCount: 0,
        });
    });

    it("removes an entry when latest availability is zero", async () => {
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted: vi.fn(),
        }));
        await waitFor(() => expect(result.current.cartSize).toBe(0));

        act(() => result.current.addVariantToCart(item, item.variants[0], 2));
        let reconciliation: StockCartAvailabilityReconciliation | null = null;
        act(() => {
            reconciliation = result.current.reconcileAvailability([{
                ...item,
                variants: [{ ...item.variants[0], availableQuantity: 0 }],
            }]);
        });

        expect(result.current.cartSize).toBe(0);
        expect(reconciliation).toEqual({
            changed: true,
            adjustedCount: 0,
            removedCount: 1,
        });
    });

    it("keeps requested quantity when latest availability increases", async () => {
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted: vi.fn(),
        }));
        await waitFor(() => expect(result.current.cartSize).toBe(0));

        act(() => result.current.addVariantToCart(item, item.variants[0], 2));
        let reconciliation: StockCartAvailabilityReconciliation | null = null;
        act(() => {
            reconciliation = result.current.reconcileAvailability([{
                ...item,
                variants: [{ ...item.variants[0], availableQuantity: 8 }],
            }]);
        });

        expect(result.current.cartItems).toMatchObject([{
            qty: 2,
            variant: { id: 101, availableQuantity: 8 },
        }]);
        expect(reconciliation).toEqual({
            changed: true,
            adjustedCount: 0,
            removedCount: 0,
        });
    });

    it("leaves variants absent from the current catalog response unchanged", async () => {
        const { result } = renderHook(() => useStockBrowseCart({
            userId: 7,
            onSubmitted: vi.fn(),
        }));
        await waitFor(() => expect(result.current.cartSize).toBe(0));

        act(() => result.current.addVariantToCart(item, item.variants[0], 2));
        let reconciliation: StockCartAvailabilityReconciliation | null = null;
        act(() => {
            reconciliation = result.current.reconcileAvailability([{
                ...item,
                variants: [{
                    ...item.variants[0],
                    id: 202,
                    availableQuantity: 0,
                }],
            }]);
        });

        expect(result.current.cartItems).toMatchObject([{
            qty: 2,
            variant: { id: 101, availableQuantity: 10 },
        }]);
        expect(reconciliation).toEqual({
            changed: false,
            adjustedCount: 0,
            removedCount: 0,
        });
    });
});
