import { describe, expect, it } from "vitest";
import {
    buildStockItemsQuery,
    createStockDashboardUrl,
    getStockItemsLimit,
    getStockItemsPageQueryKey,
    STOCK_ADMIN_ITEMS_LIMIT,
    STOCK_BROWSE_LIMIT,
    STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY,
    STOCK_ITEMS_PAGE_QUERY_KEY,
} from "@/components/dashboard/context/stock/provider.shared";

function getQueryParams(url: string): URLSearchParams {
    const query = url.split("?")[1] ?? "";
    return new URLSearchParams(query);
}

describe("stock provider shared pagination helpers", () => {
    it("uses separate item page query keys for browse and inventory tabs", () => {
        expect(getStockItemsPageQueryKey("browse")).toBe(STOCK_ITEMS_PAGE_QUERY_KEY);
        expect(getStockItemsPageQueryKey("inventory")).toBe(
            STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY,
        );
    });

    it("uses the correct item limits for browse and inventory tabs", () => {
        expect(getStockItemsLimit("browse")).toBe(STOCK_BROWSE_LIMIT);
        expect(getStockItemsLimit("inventory")).toBe(STOCK_ADMIN_ITEMS_LIMIT);
    });

    it("builds stock item queries with the active tab pagination limit", () => {
        const browseParams = getQueryParams(
            buildStockItemsQuery({
                activeTab: "browse",
                itemsPage: 4,
                searchQuery: "",
                selectedCategoryId: undefined,
            }),
        );
        const inventoryParams = getQueryParams(
            buildStockItemsQuery({
                activeTab: "inventory",
                itemsPage: 4,
                searchQuery: "",
                selectedCategoryId: undefined,
            }),
        );

        expect(browseParams.get("page")).toBe("4");
        expect(browseParams.get("limit")).toBe(String(STOCK_BROWSE_LIMIT));
        expect(inventoryParams.get("page")).toBe("4");
        expect(inventoryParams.get("limit")).toBe(String(STOCK_ADMIN_ITEMS_LIMIT));
    });

    it("can remove the inventory page query when shared filters reset pages", () => {
        const params = new URLSearchParams({
            tab: "stock",
            stockTab: "inventory",
            [STOCK_ITEMS_PAGE_QUERY_KEY]: "2",
            [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: "5",
        });

        const url = createStockDashboardUrl(params, {
            [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
            [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: null,
        });

        const nextParams = getQueryParams(url);
        expect(nextParams.get(STOCK_ITEMS_PAGE_QUERY_KEY)).toBe("1");
        expect(nextParams.has(STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY)).toBe(false);
    });
});
