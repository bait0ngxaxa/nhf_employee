"use client";

import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { type StockRequestStatus } from "@prisma/client";
import { isAdminRole } from "@/lib/ssot/permissions";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { StockDataContext, StockUIContext } from "./StockContext";
import {
    useStockCategoriesQuery,
    useStockItemsQuery,
    useStockRequestsQuery,
    type StockItemsResponse,
    type StockRequestsResponse,
} from "./hooks";
import {
    buildStockItemsQuery,
    buildStockRequestsQuery,
    createStockDashboardUrl,
    getStockItemsLimit,
    getStockItemsPageQueryKey,
    isStockDashboardRoute,
    normalizePositivePage,
    normalizeStockTab,
    parseOptionalPositiveInteger,
    parsePositivePage,
    STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY,
    STOCK_ITEMS_CATEGORY_QUERY_KEY,
    STOCK_ITEMS_PAGE_QUERY_KEY,
    STOCK_ITEMS_SEARCH_QUERY_KEY,
    STOCK_REQUESTS_LIMIT,
    STOCK_REQUESTS_PAGE_QUERY_KEY,
    STOCK_TAB_QUERY_KEY,
} from "./provider.shared";
import type {
    StockDataContextValue,
    StockUIContextValue,
} from "./types";
import { useAuth } from "@/modules/auth/client";

const EMPTY_STOCK_CAPABILITIES: StockPresentationCapabilities = Object.freeze({
    canReadCatalog: false,
    canReadOwnRequests: false,
    canReadAllRequests: false,
    canCreateRequests: false,
    canCancelOwnRequests: false,
    canCancelAnyRequests: false,
    canProcessRequests: false,
    canManageInventory: false,
    canReadReports: false,
    canExportReports: false,
});

const STOCK_ITEMS_SEARCH_DEBOUNCE_MS = 500;

function subscribeToHistory(listener: () => void): () => void {
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
}

function updateStockUrl(
    mode: "push" | "replace",
    updates: Record<string, string | null>,
): void {
    if (!isStockDashboardRoute(window.location.pathname)) return;

    const url = createStockDashboardUrl(new URLSearchParams(window.location.search), updates);
    // Stock's URL state is client-side. Use Next.js's native History integration
    // so a local write commits immediately and cannot arrive after a newer write.
    if (mode === "push") {
        window.history.pushState(null, "", url);
    } else {
        window.history.replaceState(null, "", url);
    }
}

function createSearchState(urlQuery: string, traversal: number) {
    return {
        urlQuery,
        traversal,
        draft: urlQuery,
        appliedQuery: urlQuery,
        pending: false,
        composing: false,
    };
}

interface StockProviderProps {
    children: ReactNode;
}

export function StockProvider({ children }: StockProviderProps): ReactNode {
    const { user } = useAuth();
    const nextSearchParams = useSearchParams().toString();
    const pathname = usePathname();
    // Next's snapshot signals navigation. The browser URL is already current
    // even if Next acknowledges one of our synchronous writes late.
    const currentUrlSearch = useSyncExternalStore(
        subscribeToHistory,
        () => window.location.pathname === pathname ? window.location.search.slice(1) : nextSearchParams,
        () => nextSearchParams,
    );
    const searchParams = useMemo(() => new URLSearchParams(currentUrlSearch), [currentUrlSearch]);
    const isAdmin = isAdminRole(user?.role);
    const stockCapabilities = user?.stockCapabilities ?? EMPTY_STOCK_CAPABILITIES;
    const tabFromUrl = normalizeStockTab(
        searchParams.get(STOCK_TAB_QUERY_KEY),
        stockCapabilities,
    );

    const browseItemsPage = parsePositivePage(
        searchParams.get(STOCK_ITEMS_PAGE_QUERY_KEY),
    );
    const inventoryItemsPage = parsePositivePage(
        searchParams.get(STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY)
        ?? (tabFromUrl === "inventory"
            ? searchParams.get(STOCK_ITEMS_PAGE_QUERY_KEY)
            : null),
    );
    const requestsPage = parsePositivePage(
        searchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY),
    );
    const [requestSearchQuery, setRequestSearchQuery] = useState("");
    const debouncedRequestSearchQuery = useDebouncedValue(requestSearchQuery);
    const canonicalSearchQuery = searchParams.get(STOCK_ITEMS_SEARCH_QUERY_KEY) ?? "";
    const [traversal, setTraversal] = useState(0);
    useEffect(() => subscribeToHistory(() => setTraversal((current) => current + 1)), []);
    const [search, setSearch] = useState(() => createSearchState(canonicalSearchQuery, traversal));
    if (search.urlQuery !== canonicalSearchQuery || search.traversal !== traversal) {
        // Search writes record their URL query with the applied query below.
        // Other query changes and browser Back/Forward restore the URL's search.
        setSearch(createSearchState(canonicalSearchQuery, traversal));
    }
    const { draft: searchQuery, appliedQuery: debouncedSearchQuery, pending, composing } = search;
    const selectedCategoryId = parseOptionalPositiveInteger(
        searchParams.get(STOCK_ITEMS_CATEGORY_QUERY_KEY),
    );
    const [statusFilter, setStatusFilter] = useState<
        StockRequestStatus | undefined
    >();
    const previousRequestFilterKeyRef = useRef<string | null>(null);
    const activeTab = tabFromUrl;
    const itemsPage = pending ? 1 : activeTab === "inventory" ? inventoryItemsPage : browseItemsPage;

    useEffect(() => {
        const rawTab = searchParams.get(STOCK_TAB_QUERY_KEY);
        if (
            !isStockDashboardRoute(pathname)
            || rawTab === null
            || rawTab === tabFromUrl
            || !tabFromUrl
        ) {
            return;
        }

        updateStockUrl("replace", {
            [STOCK_TAB_QUERY_KEY]: tabFromUrl,
        });
    }, [pathname, searchParams, tabFromUrl]);

    const setActiveTab = useCallback(
        (tab: string) => {
            const nextTab = normalizeStockTab(tab, stockCapabilities);

            if (!nextTab) {
                return;
            }

            if (!isStockDashboardRoute(pathname)) {
                return;
            }

            if (searchParams.get(STOCK_TAB_QUERY_KEY) === nextTab) {
                return;
            }

            updateStockUrl("push", {
                [STOCK_TAB_QUERY_KEY]: nextTab,
            });
        },
        [pathname, searchParams, stockCapabilities],
    );

    const navigateToInventory = useCallback((sku: string): void => {
        if (!isStockDashboardRoute(pathname)
            || !stockCapabilities.canReadCatalog
            || !stockCapabilities.canManageInventory) return;

        const query = sku.trim();
        setSearch(createSearchState(query, traversal));
        updateStockUrl("push", {
            [STOCK_TAB_QUERY_KEY]: "inventory",
            [STOCK_ITEMS_SEARCH_QUERY_KEY]: query || null,
            [STOCK_ITEMS_CATEGORY_QUERY_KEY]: null,
            [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
            [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: "1",
        });
    }, [pathname, stockCapabilities, traversal]);

    const setRequestsPage = useCallback(
        (page: number) => {
            const nextPage = normalizePositivePage(page);

            if (!isStockDashboardRoute(pathname)) {
                return;
            }

            const currentPage = parsePositivePage(
                searchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY),
            );
            if (currentPage === nextPage) return;

            updateStockUrl("push", {
                [STOCK_REQUESTS_PAGE_QUERY_KEY]: String(nextPage),
            });
        },
        [pathname, searchParams],
    );

    const setItemsPage = useCallback(
        (page: number) => {
            const nextPage = normalizePositivePage(page);
            const pageQueryKey = getStockItemsPageQueryKey(activeTab);

            if (!isStockDashboardRoute(pathname)) {
                return;
            }

            const currentPage = parsePositivePage(
                searchParams.get(pageQueryKey),
            );
            if (currentPage === nextPage) return;

            updateStockUrl("push", {
                [pageQueryKey]: String(nextPage),
            });
        },
        [activeTab, pathname, searchParams],
    );

    const setSearchQuery = useCallback((value: string, isComposing?: boolean): void => {
        setSearch((current) => {
            const nextComposing = isComposing ?? current.composing;
            if (current.draft === value && current.composing === nextComposing) return current;

            return {
                ...current,
                draft: value,
                pending: current.pending || current.draft !== value,
                composing: nextComposing,
            };
        });
    }, []);

    useEffect(() => {
        if (!pending || composing || !isStockDashboardRoute(pathname)) return;

        const timer = window.setTimeout(() => {
            // Compare against the live location in case a browser navigation
            // happened before the next React render.
            if (window.location.pathname !== pathname) return;
            const params = new URLSearchParams(window.location.search);
            if ((params.get(STOCK_ITEMS_SEARCH_QUERY_KEY) ?? "") !== canonicalSearchQuery) return;

            const appliedQuery = searchQuery.trim();
            setSearch((current) => ({
                ...current,
                urlQuery: appliedQuery,
                appliedQuery,
                pending: false,
            }));
            if (appliedQuery === canonicalSearchQuery
                && parsePositivePage(params.get(STOCK_ITEMS_PAGE_QUERY_KEY)) === 1
                && !params.has(STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY)) return;

            updateStockUrl("replace", {
                [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
                [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: null,
                [STOCK_ITEMS_SEARCH_QUERY_KEY]: appliedQuery || null,
            });
        }, STOCK_ITEMS_SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [canonicalSearchQuery, composing, pathname, pending, searchQuery]);

    const setSelectedCategoryId = useCallback(
        (categoryId: number | undefined) => {
            if (!isStockDashboardRoute(pathname)) {
                return;
            }

            updateStockUrl("replace", {
                [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
                [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: null,
                [STOCK_ITEMS_CATEGORY_QUERY_KEY]:
                    categoryId === undefined ? null : String(categoryId),
            });
        },
        [pathname],
    );

    const itemsQuery = useMemo(
        () =>
            buildStockItemsQuery({
                activeTab,
                itemsPage,
                searchQuery: debouncedSearchQuery,
                selectedCategoryId,
            }),
        [activeTab, debouncedSearchQuery, itemsPage, selectedCategoryId],
    );

    const shouldFetchCatalogData = stockCapabilities.canReadCatalog;
    const shouldFetchItems =
        (activeTab === "browse" && stockCapabilities.canReadCatalog)
        || (
            activeTab === "inventory"
            && stockCapabilities.canReadCatalog
            && stockCapabilities.canManageInventory
        );
    const shouldFetchRequests =
        (activeTab === "my-requests" && stockCapabilities.canReadOwnRequests)
        || (activeTab === "admin-requests" && stockCapabilities.canReadAllRequests);

    const requestsQuery = useMemo(
        () =>
            buildStockRequestsQuery({
                activeTab,
                stockCapabilities,
                requestSearchQuery: debouncedRequestSearchQuery,
                requestsPage,
                statusFilter,
            }),
        [
            activeTab,
            debouncedRequestSearchQuery,
            requestsPage,
            statusFilter,
            stockCapabilities,
        ],
    );

    const itemsQueryKey = shouldFetchItems ? itemsQuery : null;
    const requestsQueryKey = shouldFetchRequests ? requestsQuery : null;

    const reconcileItemsPage = useCallback(
        (response: StockItemsResponse, responseKey: string): void => {
            if (responseKey !== itemsQueryKey) {
                return;
            }

            const totalPages = Math.max(
                1,
                Math.ceil((response.total ?? 0) / getStockItemsLimit(activeTab)),
            );
            if (itemsPage > totalPages) {
                setItemsPage(totalPages);
            }
        },
        [activeTab, itemsPage, itemsQueryKey, setItemsPage],
    );

    const reconcileRequestsPage = useCallback(
        (response: StockRequestsResponse, responseKey: string): void => {
            if (responseKey !== requestsQueryKey) {
                return;
            }

            const totalPages = Math.max(
                1,
                Math.ceil((response.total ?? 0) / STOCK_REQUESTS_LIMIT),
            );
            if (requestsPage > totalPages) {
                setRequestsPage(totalPages);
            }
        },
        [requestsPage, requestsQueryKey, setRequestsPage],
    );

    const {
        data: categoriesData,
        isLoading: isCategoriesLoading,
        mutate: mutateCategories,
    } = useStockCategoriesQuery(shouldFetchCatalogData);
    const {
        data: itemsData,
        isLoading: isItemsLoading,
        mutate: mutateItems,
    } = useStockItemsQuery(itemsQueryKey, reconcileItemsPage);
    const {
        data: requestsData,
        isLoading: isRequestsLoading,
        mutate: mutateRequests,
    } = useStockRequestsQuery(requestsQueryKey, reconcileRequestsPage);

    const refreshCategories = useCallback((): void => {
        void mutateCategories();
    }, [mutateCategories]);

    const refreshItems = useCallback((): void => {
        void mutateItems();
    }, [mutateItems]);

    const refreshRequests = useCallback((): void => {
        void mutateRequests();
    }, [mutateRequests]);

    const requestFilterKey = `${requestSearchQuery}\u0000${statusFilter ?? ""}`;

    useEffect(() => {
        if (previousRequestFilterKeyRef.current === null) {
            previousRequestFilterKeyRef.current = requestFilterKey;
            return;
        }
        if (previousRequestFilterKeyRef.current === requestFilterKey) {
            return;
        }
        previousRequestFilterKeyRef.current = requestFilterKey;
        setRequestsPage(1);
    }, [requestFilterKey, setRequestsPage]);

    const categories = useMemo(
        () => categoriesData?.categories ?? [],
        [categoriesData?.categories],
    );
    const items = useMemo(
        () => itemsData?.items ?? [],
        [itemsData?.items],
    );
    const requests = useMemo(
        () => requestsData?.requests ?? [],
        [requestsData?.requests],
    );
    const totalItems = itemsData?.total ?? 0;
    const totalRequests = requestsData?.total ?? 0;
    const isLoading = (shouldFetchCatalogData && isCategoriesLoading)
        || (shouldFetchItems && (isItemsLoading || !itemsData))
        || (shouldFetchRequests && (isRequestsLoading || !requestsData));

    const dataValue: StockDataContextValue = useMemo(
        () => ({
            categories,
            items,
            requests,
            totalItems,
            totalRequests,
            isLoading,
            isAdmin,
            stockCapabilities,
            refreshItems,
            refreshRequests,
            refreshCategories,
        }),
        [
            categories,
            items,
            requests,
            totalItems,
            totalRequests,
            isLoading,
            isAdmin,
            stockCapabilities,
            refreshItems,
            refreshRequests,
            refreshCategories,
        ],
    );

    const uiValue: StockUIContextValue = useMemo(
        () => ({
            activeTab,
            setActiveTab,
            navigateToInventory,
            itemsPage,
            setItemsPage,
            requestsPage,
            setRequestsPage,
            requestSearchQuery,
            setRequestSearchQuery,
            searchQuery,
            setSearchQuery,
            selectedCategoryId,
            setSelectedCategoryId,
            statusFilter,
            setStatusFilter,
        }),
        [
            activeTab,
            setActiveTab,
            navigateToInventory,
            itemsPage,
            requestsPage,
            searchQuery,
            requestSearchQuery,
            selectedCategoryId,
            statusFilter,
            setRequestsPage,
            setItemsPage,
            setSearchQuery,
            setSelectedCategoryId,
        ],
    );

    return (
        <StockDataContext.Provider value={dataValue}>
            <StockUIContext.Provider value={uiValue}>
                {children}
            </StockUIContext.Provider>
        </StockDataContext.Provider>
    );
}
