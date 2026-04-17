import { type StockRequestStatus } from "@prisma/client";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";

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
    isAdmin: boolean;
    requestSearchQuery: string;
    requestsPage: number;
    statusFilter: StockRequestStatus | undefined;
};

const DASHBOARD_TAB_QUERY_KEY = "tab";
const DASHBOARD_STOCK_MENU = "stock";
const DASHBOARD_STOCK_MENU_LEGACY = "it-equipment";
const STOCK_DEFAULT_TAB = "browse";
const STOCK_ADMIN_TABS = new Set(["inventory", "admin-requests"]);

export const STOCK_TAB_QUERY_KEY = "stockTab";
export const STOCK_REQUESTS_PAGE_QUERY_KEY = "stockRequestsPage";
export const STOCK_BROWSE_LIMIT = 12;
export const STOCK_ADMIN_ITEMS_LIMIT = 10;
export const STOCK_REQUESTS_LIMIT = 10;

export function normalizeStockTab(tab: string | null, isAdmin: boolean): string {
    if (!tab) {
        return STOCK_DEFAULT_TAB;
    }
    if (!isAdmin && STOCK_ADMIN_TABS.has(tab)) {
        return STOCK_DEFAULT_TAB;
    }
    return tab;
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

export function isStockDashboardMenu(tab: string | null): boolean {
    return tab === DASHBOARD_STOCK_MENU || tab === DASHBOARD_STOCK_MENU_LEGACY;
}

export function isStockDashboardRoute(
    pathname: string,
    searchParams: SearchParamsLike,
): boolean {
    return pathname === APP_ROUTES.dashboard
        && isStockDashboardMenu(searchParams.get(DASHBOARD_TAB_QUERY_KEY));
}

export function buildStockItemsQuery({
    activeTab,
    itemsPage,
    searchQuery,
    selectedCategoryId,
}: BuildStockItemsQueryParams): string {
    const itemsLimit =
        activeTab === "inventory" ? STOCK_ADMIN_ITEMS_LIMIT : STOCK_BROWSE_LIMIT;
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
    isAdmin,
    requestSearchQuery,
    requestsPage,
    statusFilter,
}: BuildStockRequestsQueryParams): string {
    const requestScope =
        isAdmin && activeTab === "admin-requests" ? "all" : "mine";
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
    updates: Record<string, string>,
): string {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set(DASHBOARD_TAB_QUERY_KEY, DASHBOARD_STOCK_MENU);

    for (const [key, value] of Object.entries(updates)) {
        nextParams.set(key, value);
    }

    return `${APP_ROUTES.dashboard}?${nextParams.toString()}`;
}
