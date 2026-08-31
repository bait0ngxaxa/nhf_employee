import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGetMock, apiPostMock } = vi.hoisted(() => ({
    apiGetMock: vi.fn(),
    apiPostMock: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: apiGetMock,
    apiPost: apiPostMock,
}));

import {
    fetchLiffStockItems,
    fetchLiffStockMyRequests,
    fetchLiffStockProcessingQueue,
    issueLiffStockRequest,
    submitLiffStockRequest,
    fetchLiffStockVariantAvailability,
} from "@/lib/client/liff-stock";
import { API_ROUTES } from "@/lib/ssot/routes";

const SUCCESS = {
    success: true as const,
    data: {},
    status: 200,
    requestId: "request-1",
};

const LIFF_OPTIONS = {
    credentials: "include" as const,
    retryCount: 0,
    skipAuthRefresh: true,
};

describe("LIFF Stock client", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGetMock.mockResolvedValue(SUCCESS);
        apiPostMock.mockResolvedValue(SUCCESS);
    });

    it("keeps catalog search and category filtering on the LIFF API", async () => {
        const expectedParams = new URLSearchParams({
            page: "2",
            limit: "12",
            search: "กระดาษ A4",
            categoryId: "7",
        });

        await fetchLiffStockItems({
            page: 2,
            limit: 12,
            search: "กระดาษ A4",
            categoryId: 7,
        });

        expect(apiGetMock).toHaveBeenCalledWith(
            `${API_ROUTES.line.stockItems}?${expectedParams.toString()}`,
            LIFF_OPTIONS,
        );
        expect(apiGetMock.mock.calls[0]?.[0]).not.toContain("/api/stock/");
    });

    it("submits with the caller-owned retry-safe idempotency key", async () => {
        const payload = {
            projectCode: "NHF-2569",
            items: [{ itemId: 10, variantId: 101, quantity: 2 }],
        };

        await submitLiffStockRequest(payload, "stock-key-12345678");

        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.line.stockRequests,
            payload,
            {
                ...LIFF_OPTIONS,
                headers: { "Idempotency-Key": "stock-key-12345678" },
            },
        );
    });

    it("uses separate employee and processor list adapters", async () => {
        await fetchLiffStockMyRequests({
            page: 3,
            search: "NHF",
            status: "PENDING_ISSUE",
        });
        await fetchLiffStockProcessingQueue({ page: 1, search: "ปากกา" });
        await issueLiffStockRequest(71);

        expect(apiGetMock).toHaveBeenNthCalledWith(
            1,
            `${API_ROUTES.line.stockRequests}?page=3&search=NHF&status=PENDING_ISSUE`,
            LIFF_OPTIONS,
        );
        expect(apiGetMock).toHaveBeenNthCalledWith(
            2,
            `${API_ROUTES.line.stockProcessing}?page=1&search=${encodeURIComponent("ปากกา")}`,
            LIFF_OPTIONS,
        );
        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.line.stockIssueById(71),
            {},
            LIFF_OPTIONS,
        );
    });

    it("fetches targeted variant availability through the LIFF API", async () => {
        apiGetMock.mockResolvedValueOnce({
            ...SUCCESS,
            data: {
                variants: [{ id: 101, availableQuantity: 4 }],
            },
        });

        await fetchLiffStockVariantAvailability([101, 101, 205]);

        expect(apiGetMock).toHaveBeenCalledWith(
            `${API_ROUTES.line.stockAvailability}?variantIds=101%2C205`,
            LIFF_OPTIONS,
        );
    });
});
