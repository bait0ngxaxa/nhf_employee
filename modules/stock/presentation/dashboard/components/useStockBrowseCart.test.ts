import { createElement, type ReactElement } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearStockBrowseCart,
    useStockBrowseCart,
    type StockCartVariantAvailability,
    type StockCartAvailabilityReconciliation,
} from "./useStockBrowseCart";
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

    function writePersistedCart(
        key: string,
        projectCode: string,
        itemId: number,
        variantId: number,
        quantity: number,
        pendingIdempotency: { payloadSignature: string; key: string } | null = null,
    ): string {
        const serialized = JSON.stringify({
            projectCode,
            cartItems: [{
                itemId,
                itemName: itemId === 10 ? "กระดาษ" : "ปากกา",
                itemImageUrl: null,
                variantId,
                variantSku: itemId === 10 ? "PAPER-A4" : "PEN-BLUE",
                variantUnit: itemId === 10 ? "รีม" : "ด้าม",
                variantImageUrl: null,
                variantAvailableQuantity: 20,
                qty: quantity,
            }],
            pendingIdempotency,
        });
        window.localStorage.setItem(key, serialized);
        return serialized;
    }

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

    it("does not read localStorage for its server snapshot", () => {
        function CartServerProbe(): ReactElement {
            const { cartSize } = useStockBrowseCart({
                canCreateRequests: true,
                userId: 701,
                onSubmitted: vi.fn(),
            });

            return createElement("output", null, String(cartSize));
        }

        const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
        expect(renderToString(createElement(CartServerProbe))).toContain(
            ">0<",
        );
        expect(getItemSpy).not.toHaveBeenCalled();
        getItemSpy.mockRestore();
    });

    it("does not write an empty default when storage is empty", async () => {
        const { result } = renderHook(() => useStockBrowseCart({
            canCreateRequests: true,
            userId: 7,
            onSubmitted: vi.fn(),
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(0));
        expect(window.localStorage.getItem(storageKey)).toBeNull();
    });

    it("restores an existing cart and project code without rewriting its stored value", async () => {
        const storedValue = writePersistedCart(
            storageKey,
            " nhf 2569 ",
            10,
            101,
            2,
        );
        const { result } = renderHook(() => useStockBrowseCart({
            canCreateRequests: true,
            userId: " 7 ",
            onSubmitted: vi.fn(),
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(1));
        expect(result.current.projectCode).toBe("NHF2569");
        expect(window.localStorage.getItem(storageKey)).toBe(storedValue);
    });

    it("keeps user A and user B isolated when the same hook instance switches users", async () => {
        const userAKey = "stock:browse-cart:v1:user:7";
        const userBKey = "stock:browse-cart:v1:user:8";
        const userAValue = writePersistedCart(userAKey, "PROJECT-A", 10, 101, 2);
        const userBValue = writePersistedCart(userBKey, "PROJECT-B", 20, 202, 3);
        const { result, rerender } = renderHook<
            ReturnType<typeof useStockBrowseCart>,
            { userId: number | null }
        >(
            ({ userId }: { userId: number | null }) => useStockBrowseCart({
                canCreateRequests: true,
                userId,
                onSubmitted: vi.fn(),
            }),
            { initialProps: { userId: 7 } },
        );

        await waitFor(() => expect(result.current.cartItems[0]?.variant.id).toBe(101));
        rerender({ userId: 8 });

        await waitFor(() => expect(result.current.cartItems[0]?.variant.id).toBe(202));
        expect(result.current.projectCode).toBe("PROJECT-B");
        expect(window.localStorage.getItem(userAKey)).toBe(userAValue);
        expect(window.localStorage.getItem(userBKey)).toBe(userBValue);
    });

    it("never reuses user A's pending idempotency key for user B", async () => {
        const userAKey = "stock:browse-cart:v1:user:7";
        const userBKey = "stock:browse-cart:v1:user:8";
        const pendingA = {
            payloadSignature: JSON.stringify({
                projectCode: "PROJECT-A",
                items: [{ itemId: 10, variantId: 101, quantity: 2 }],
            }),
            key: "user-a-key",
        };
        writePersistedCart(userAKey, "PROJECT-A", 10, 101, 2, pendingA);
        writePersistedCart(userBKey, "PROJECT-B", 20, 202, 3);
        const submitTransport = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            ({ userId }: { userId: number }) => useStockBrowseCart({
                canCreateRequests: true,
                userId,
                onSubmitted: vi.fn(),
                submitRequest: submitTransport,
            }),
            { initialProps: { userId: 7 } },
        );

        await waitFor(() => expect(result.current.cartSize).toBe(1));
        rerender({ userId: 8 });
        await waitFor(() => expect(result.current.projectCode).toBe("PROJECT-B"));

        await act(async () => result.current.submitRequest());
        expect(submitTransport).toHaveBeenCalledTimes(1);
        expect(submitTransport.mock.calls[0]?.[1]).not.toBe("user-a-key");
        expect(window.localStorage.getItem(userAKey)).toContain("user-a-key");
    });

    it("does not expose a user's cart or write an unscoped key across null transitions", async () => {
        const userAKey = "stock:browse-cart:v1:user:7";
        writePersistedCart(userAKey, "PROJECT-A", 10, 101, 2);
        const { result, rerender } = renderHook<
            ReturnType<typeof useStockBrowseCart>,
            { userId: number | null }
        >(
            ({ userId }: { userId: number | null }) => useStockBrowseCart({
                canCreateRequests: true,
                userId,
                onSubmitted: vi.fn(),
            }),
            { initialProps: { userId: 7 } },
        );

        await waitFor(() => expect(result.current.cartSize).toBe(1));
        rerender({ userId: null });
        await waitFor(() => {
            expect(result.current.cartSize).toBe(0);
            expect(result.current.projectCode).toBe("");
        });
        expect(window.localStorage.getItem(userAKey)).not.toBeNull();
        expect(window.localStorage.getItem("stock:browse-cart:v1")).toBeNull();
    });

    it("loads a user's persisted cart after a null-to-user transition", async () => {
        const userAKey = "stock:browse-cart:v1:user:7";
        writePersistedCart(userAKey, "PROJECT-A", 10, 101, 2);
        const { result, rerender } = renderHook<
            ReturnType<typeof useStockBrowseCart>,
            { userId: number | null }
        >(
            ({ userId }: { userId: number | null }) => useStockBrowseCart({
                canCreateRequests: true,
                userId,
                onSubmitted: vi.fn(),
            }),
            { initialProps: { userId: null as number | null } },
        );

        await waitFor(() => expect(result.current.cartSize).toBe(0));
        expect(window.localStorage.getItem("stock:browse-cart:v1")).toBeNull();
        rerender({ userId: 7 });

        await waitFor(() => expect(result.current.cartSize).toBe(1));
        expect(result.current.projectCode).toBe("PROJECT-A");
    });

    it("continues with an in-memory cart when reading storage fails", async () => {
        const getItemSpy = vi.spyOn(Storage.prototype, "getItem")
            .mockImplementation(() => {
                throw new Error("storage unavailable");
            });
        const item = {
            id: 10,
            name: "กระดาษ",
            imageUrl: null,
            defaultVariantId: 101,
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
            canCreateRequests: true,
            userId: 7,
            onSubmitted: vi.fn(),
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(0));
        act(() => result.current.addDirectItem(item));
        expect(result.current.cartSize).toBe(1);
        getItemSpy.mockRestore();
    });

    it("clears only the target user and legacy cart keys", () => {
        const otherUserKey = "stock:browse-cart:v1:user:8";
        writePersistedCart(storageKey, "PROJECT-A", 10, 101, 2);
        window.localStorage.setItem(otherUserKey, "other-user-state");
        window.localStorage.setItem("stock:browse-cart:v1", "legacy-state");

        clearStockBrowseCart(" 7 ");

        expect(window.localStorage.getItem(storageKey)).toBeNull();
        expect(window.localStorage.getItem("stock:browse-cart:v1")).toBeNull();
        expect(window.localStorage.getItem(otherUserKey)).toBe("other-user-state");
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
            useStockBrowseCart({ canCreateRequests: true, userId: 7, onSubmitted }),
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
            defaultVariantId: 101,
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
            canCreateRequests: true,
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

    it("does not mutate the cart or submit when request creation is unavailable", async () => {
        const item = {
            id: 10,
            name: "กระดาษ",
            imageUrl: null,
            defaultVariantId: 101,
            variants: [{
                id: 101,
                sku: "PAPER-A4",
                unit: "รีม",
                imageUrl: null,
                availableQuantity: 3,
                attributeValues: [],
            }],
        };
        const submitTransport = vi.fn();
        const { result } = renderHook(() => useStockBrowseCart({
            canCreateRequests: false,
            userId: 7,
            onSubmitted: vi.fn(),
            submitRequest: submitTransport,
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(0));
        act(() => {
            result.current.addDirectItem(item);
            result.current.addVariantToCart(item, item.variants[0], 1);
            result.current.setProjectCode("NHF-2569");
        });

        await act(async () => {
            await result.current.submitRequest();
        });

        expect(result.current.cartSize).toBe(0);
        expect(submitTransport).not.toHaveBeenCalled();
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
            canCreateRequests: true,
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

    it("uses a new key after an intentional cart change following a network failure", async () => {
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
        const { result } = renderHook(() => useStockBrowseCart({
            canCreateRequests: true,
            userId: 7,
            onSubmitted: vi.fn(),
            submitRequest: submitTransport,
        }));

        await waitFor(() => expect(result.current.cartSize).toBe(1));
        await act(async () => result.current.submitRequest());
        const firstKey = submitTransport.mock.calls[0]?.[1] as string;

        act(() => result.current.updateCartQuantity(101, -1));
        await waitFor(() => expect(result.current.cartItems[0]?.qty).toBe(1));

        await act(async () => result.current.submitRequest());
        expect(submitTransport.mock.calls[1]?.[0]).toEqual({
            projectCode: payload.projectCode,
            items: [{ itemId: 10, variantId: 101, quantity: 1 }],
        });
        expect(submitTransport.mock.calls[1]?.[1]).not.toBe(firstKey);
    });

    it("uses a new idempotency key after availability reconciliation changes the payload", async () => {
        const item = {
            id: 10,
            name: "กระดาษ",
            imageUrl: null,
            defaultVariantId: 101,
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
            canCreateRequests: true,
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
        defaultVariantId: 101,
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
            canCreateRequests: true,
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
            canCreateRequests: true,
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
            canCreateRequests: true,
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
            canCreateRequests: true,
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

    it("reconciles targeted availability for the current cart variants", async () => {
        const { result } = renderHook(() => useStockBrowseCart({
            canCreateRequests: true,
            userId: 7,
            onSubmitted: vi.fn(),
        }));
        await waitFor(() => expect(result.current.cartSize).toBe(0));

        act(() => result.current.addVariantToCart(item, item.variants[0], 8));
        const targetedAvailability: StockCartVariantAvailability[] = [{
            id: 101,
            availableQuantity: 4,
        }];
        let reconciliation: StockCartAvailabilityReconciliation | null = null;
        act(() => {
            reconciliation = result.current.reconcileVariantAvailability(
                targetedAvailability,
            );
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
});
