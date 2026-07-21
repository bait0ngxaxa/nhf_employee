import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStockBrowseCart } from "@/components/dashboard/stock/useStockBrowseCart";
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
});
