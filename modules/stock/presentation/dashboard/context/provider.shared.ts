import { type StockRequestStatus } from "@prisma/client";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import type { StockPresentationCapabilities } from "@/modules/stock/client";

type SearchParamsLike = {
    get(name: string): string | null;
    toString(): string;
};

type BuildStockItemsQueryParams = {
    activeTab: string;
    itemsPage: number;
    searchQuery: string;
    selectedCategoryId: number | undefined;
};

type BuildStockRequestsQueryParams = {
    activeTab: string;
    stockCapabilities: StockPresentationCapabilities;
    requestSearchQuery: string;
    requestsPage: number;
    statusFilter: StockRequestStatus | undefined;
};

const STOCK_TAB_ORDER = [
    "browse",
    "my-requests",
    "inventory",
    "admin-requests",
    "reports",
] as const;

export const STOCK_TAB_QUERY_KEY = "stockTab";
export const STOCK_ITEMS_PAGE_QUERY_KEY = "stockItemsPage";
export const STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY = "stockInventoryPage";
export const STOCK_ITEMS_SEARCH_QUERY_KEY = "stockSearch";
export const STOCK_ITEMS_CATEGORY_QUERY_KEY = "stockCategoryId";
export const STOCK_REQUESTS_PAGE_QUERY_KEY = "stockRequestsPage";
export const STOCK_BROWSE_LIMIT = 12;
export const STOCK_ADMIN_ITEMS_LIMIT = 10;
export const STOCK_REQUESTS_LIMIT = 10;

export function getVisibleStockTabs(
    capabilities: StockPresentationCapabilities,
): string[] {
    return STOCK_TAB_ORDER.filter((tab) => {
        switch (tab) {
            case "browse":
                return capabilities.canReadCatalog;
            case "my-requests":
                return capabilities.canReadOwnRequests;
            case "inventory":
                return capabilities.canReadCatalog && capabilities.canManageInventory;
            case "admin-requests":
                return capabilities.canReadAllRequests;
            case "reports":
                return capabilities.canExportReports;
        }
    });
}

export function normalizeStockTab(
    tab: string | null,
    capabilities: StockPresentationCapabilities,
): string {
    const visibleTabs = getVisibleStockTabs(capabilities);
    if (tab && visibleTabs.includes(tab)) {
        return tab;
    }
    return visibleTabs[0] ?? "";
}

export function parsePositivePage(value: string | null): number {
    if (!value) {
        return 1;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return 1;
    }

    return parsed;
}

export function normalizePositivePage(page: number): number {
    if (!Number.isInteger(page) || page < 1) {
        return 1;
    }

    return page;
}

export function parseOptionalPositiveInteger(value: string | null): number | undefined {
    if (!value) {
        return undefined;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return undefined;
    }

    return parsed;
}

export function isStockDashboardRoute(
    pathname: string | null | undefined,
): boolean {
    return pathname === APP_ROUTES.dashboardStock;
}

export function getStockItemsLimit(activeTab: string): number {
    return activeTab === "inventory" ? STOCK_ADMIN_ITEMS_LIMIT : STOCK_BROWSE_LIMIT;
}

export function getStockItemsPageQueryKey(activeTab: string): string {
    return activeTab === "inventory"
        ? STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY
        : STOCK_ITEMS_PAGE_QUERY_KEY;
}

export function buildStockItemsQuery({
    activeTab,
    itemsPage,
    searchQuery,
    selectedCategoryId,
}: BuildStockItemsQueryParams): string {
    const itemsLimit = getStockItemsLimit(activeTab);
    const params = new URLSearchParams({
        page: String(itemsPage),
        limit: String(itemsLimit),
        activeOnly: "true",
    });

    if (searchQuery) {
        params.set("search", searchQuery);
    }
    if (selectedCategoryId !== undefined) {
        params.set("categoryId", String(selectedCategoryId));
    }

    return `${API_ROUTES.stock.items}?${params.toString()}`;
}

export function buildStockRequestsQuery({
    activeTab,
    stockCapabilities,
    requestSearchQuery,
    requestsPage,
    statusFilter,
}: BuildStockRequestsQueryParams): string {
    const requestScope =
        stockCapabilities.canReadAllRequests && activeTab === "admin-requests"
            ? "all"
            : "mine";
    const params = new URLSearchParams({
        page: String(requestsPage),
        limit: String(STOCK_REQUESTS_LIMIT),
        scope: requestScope,
    });

    if (statusFilter) {
        params.set("status", statusFilter);
    }

    const trimmedSearchQuery = requestSearchQuery.trim();
    if (trimmedSearchQuery) {
        params.set("search", trimmedSearchQuery);
    }

    return `${API_ROUTES.stock.requests}?${params.toString()}`;
}

export function createStockDashboardUrl(
    searchParams: SearchParamsLike,
    updates: Record<string, string | null>,
): string {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("tab");

    for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
            nextParams.delete(key);
            continue;
        }

        nextParams.set(key, value);
    }

    const query = nextParams.toString();
    return query
        ? `${APP_ROUTES.dashboardStock}?${query}`
        : APP_ROUTES.dashboardStock;
}
