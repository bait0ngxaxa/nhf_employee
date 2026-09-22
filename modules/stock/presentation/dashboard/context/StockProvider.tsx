"use client";

import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    canExportReports: false,
});

interface StockSearchDraftState {
    canonicalValue: string;
    value: string;
    urlSyncRevision: number;
}

function parseSearchUrlSyncInput(value: string): {
    query: string;
    revision: number;
} {
    const separatorIndex = value.indexOf("\u0000");
    if (separatorIndex < 0) {
        return { query: "", revision: 0 };
    }

    return {
        query: value.slice(separatorIndex + 1),
        revision: Number(value.slice(0, separatorIndex)),
    };
}

interface StockProviderProps {
    children: ReactNode;
}

export function StockProvider({ children }: StockProviderProps) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const isAdmin = isAdminRole(user?.role);
    const stockCapabilities = user?.stockCapabilities ?? EMPTY_STOCK_CAPABILITIES;
    const latestSearchParamsRef = useRef(searchParams);
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
    const [searchDraft, setSearchDraft] = useState<StockSearchDraftState>(() => ({
        canonicalValue: canonicalSearchQuery,
        value: canonicalSearchQuery,
        urlSyncRevision: 0,
    }));
    if (searchDraft.canonicalValue !== canonicalSearchQuery) {
        setSearchDraft({
            canonicalValue: canonicalSearchQuery,
            value: canonicalSearchQuery,
            urlSyncRevision: 0,
        });
    }
    const effectiveSearchDraft = searchDraft.canonicalValue === canonicalSearchQuery
        ? searchDraft
        : {
            canonicalValue: canonicalSearchQuery,
            value: canonicalSearchQuery,
            urlSyncRevision: 0,
        };
    const searchQuery = effectiveSearchDraft.value;
    const searchUrlSyncRevision = effectiveSearchDraft.urlSyncRevision;
    const debouncedSearchQuery = useDebouncedValue(searchQuery);
    const debouncedSearchUrlSyncInput = useDebouncedValue(
        `${searchUrlSyncRevision}\u0000${searchQuery}`,
    );
    const {
        query: debouncedSearchQueryForUrl,
        revision: debouncedSearchUrlSyncRevision,
    } = parseSearchUrlSyncInput(debouncedSearchUrlSyncInput);
    const selectedCategoryId = parseOptionalPositiveInteger(
        searchParams.get(STOCK_ITEMS_CATEGORY_QUERY_KEY),
    );
    const [statusFilter, setStatusFilter] = useState<
        StockRequestStatus | undefined
    >();
    const previousRequestFilterKeyRef = useRef<string | null>(null);
    const activeTab = tabFromUrl;
    const itemsPage =
        searchUrlSyncRevision > 0
            ? 1
            : activeTab === "inventory" ? inventoryItemsPage : browseItemsPage;

    useEffect(() => {
        latestSearchParamsRef.current = searchParams;
    }, [searchParams]);

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

        router.replace(createStockDashboardUrl(searchParams, {
            [STOCK_TAB_QUERY_KEY]: tabFromUrl,
        }), {
            scroll: false,
        });
    }, [pathname, router, searchParams, tabFromUrl]);

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

            router.push(createStockDashboardUrl(searchParams, {
                [STOCK_TAB_QUERY_KEY]: nextTab,
            }), {
                scroll: false,
            });
        },
        [pathname, router, searchParams, stockCapabilities],
    );

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

            router.push(createStockDashboardUrl(searchParams, {
                [STOCK_REQUESTS_PAGE_QUERY_KEY]: String(nextPage),
            }), {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
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

            router.push(createStockDashboardUrl(searchParams, {
                [pageQueryKey]: String(nextPage),
            }), {
                scroll: false,
            });
        },
        [activeTab, pathname, router, searchParams],
    );

    const setSearchQuery = useCallback(
        (value: string) => {
            setSearchDraft((currentDraft) => ({
                canonicalValue: canonicalSearchQuery,
                value,
                urlSyncRevision:
                    currentDraft.canonicalValue === canonicalSearchQuery
                        ? currentDraft.urlSyncRevision + 1
                        : 1,
            }));
        },
        [canonicalSearchQuery],
    );

    useEffect(() => {
        if (debouncedSearchUrlSyncRevision === 0) {
            return;
        }

        const latestSearchParams = latestSearchParamsRef.current;

        if (!isStockDashboardRoute(pathname)) {
            return;
        }

        const nextSearch = debouncedSearchQueryForUrl.trim();
        const currentSearch = latestSearchParams.get(
            STOCK_ITEMS_SEARCH_QUERY_KEY,
        ) ?? "";
        const currentPage = parsePositivePage(
            latestSearchParams.get(STOCK_ITEMS_PAGE_QUERY_KEY),
        );
        const hasInventoryPage = latestSearchParams.has(
            STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY,
        );

        if (
            currentSearch === nextSearch
            && currentPage === 1
            && !hasInventoryPage
        ) {
            return;
        }

        router.replace(createStockDashboardUrl(latestSearchParams, {
            [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
            [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: null,
            [STOCK_ITEMS_SEARCH_QUERY_KEY]: nextSearch || null,
        }), {
            scroll: false,
        });
    }, [
        debouncedSearchQueryForUrl,
        debouncedSearchUrlSyncRevision,
        pathname,
        router,
    ]);

    const setSelectedCategoryId = useCallback(
        (categoryId: number | undefined) => {
            if (!isStockDashboardRoute(pathname)) {
                return;
            }

            router.replace(createStockDashboardUrl(searchParams, {
                [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
                [STOCK_INVENTORY_ITEMS_PAGE_QUERY_KEY]: null,
                [STOCK_ITEMS_CATEGORY_QUERY_KEY]:
                    categoryId === undefined ? null : String(categoryId),
            }), {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
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
