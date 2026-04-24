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
import { useSession } from "next-auth/react";
import { isAdminRole } from "@/lib/ssot/permissions";
import { StockDataContext, StockUIContext } from "./StockContext";
import {
    useStockCategoriesQuery,
    useStockItemsQuery,
    useStockRequestsQuery,
} from "./hooks";
import {
    buildStockItemsQuery,
    buildStockRequestsQuery,
    createStockDashboardUrl,
    isStockDashboardRoute,
    normalizeStockTab,
    parseOptionalPositiveInteger,
    parsePositivePage,
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

interface StockProviderProps {
    children: ReactNode;
}

export function StockProvider({ children }: StockProviderProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const isAdmin = isAdminRole(session?.user?.role);
    const latestSearchParamsRef = useRef(searchParams);

    const [activeTab, setActiveTabState] = useState(
        normalizeStockTab(searchParams.get(STOCK_TAB_QUERY_KEY), isAdmin),
    );
    const [itemsPage, setItemsPageState] = useState(
        parsePositivePage(searchParams.get(STOCK_ITEMS_PAGE_QUERY_KEY)),
    );
    const [requestsPage, setRequestsPageState] = useState(
        parsePositivePage(searchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY)),
    );
    const [requestSearchQuery, setRequestSearchQuery] = useState("");
    const [searchQuery, setSearchQueryState] = useState(
        searchParams.get(STOCK_ITEMS_SEARCH_QUERY_KEY) ?? "",
    );
    const [selectedCategoryId, setSelectedCategoryIdState] = useState<
        number | undefined
    >(parseOptionalPositiveInteger(searchParams.get(STOCK_ITEMS_CATEGORY_QUERY_KEY)));
    const [statusFilter, setStatusFilter] = useState<
        StockRequestStatus | undefined
    >();
    const hasInitializedStatusFilterRef = useRef(false);

    useEffect(() => {
        latestSearchParamsRef.current = searchParams;
    }, [searchParams]);

    useEffect(() => {
        const tabFromUrl = searchParams.get(STOCK_TAB_QUERY_KEY);
        const nextTab = normalizeStockTab(tabFromUrl, isAdmin);
        setActiveTabState((prev) => (prev === nextTab ? prev : nextTab));
    }, [searchParams, isAdmin]);

    useEffect(() => {
        const pageFromUrl = parsePositivePage(
            searchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY),
        );
        setRequestsPageState((prev) =>
            prev === pageFromUrl ? prev : pageFromUrl,
        );
    }, [searchParams]);

    useEffect(() => {
        const pageFromUrl = parsePositivePage(
            searchParams.get(STOCK_ITEMS_PAGE_QUERY_KEY),
        );
        setItemsPageState((prev) => (prev === pageFromUrl ? prev : pageFromUrl));

        const searchFromUrl = searchParams.get(STOCK_ITEMS_SEARCH_QUERY_KEY) ?? "";
        setSearchQueryState((prev) =>
            prev === searchFromUrl ? prev : searchFromUrl,
        );

        const categoryFromUrl = parseOptionalPositiveInteger(
            searchParams.get(STOCK_ITEMS_CATEGORY_QUERY_KEY),
        );
        setSelectedCategoryIdState((prev) =>
            prev === categoryFromUrl ? prev : categoryFromUrl,
        );
    }, [searchParams]);

    const setActiveTab = useCallback(
        (tab: string) => {
            const nextTab = normalizeStockTab(tab, isAdmin);
            setActiveTabState(nextTab);

            if (!isStockDashboardRoute(pathname, searchParams)) {
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
        [isAdmin, pathname, router, searchParams],
    );

    const setRequestsPage = useCallback(
        (page: number) => {
            const nextPage = Number.isInteger(page) && page > 0 ? page : 1;
            setRequestsPageState(nextPage);

            if (!isStockDashboardRoute(pathname, searchParams)) {
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
            const nextPage = Number.isInteger(page) && page > 0 ? page : 1;
            setItemsPageState(nextPage);

            if (!isStockDashboardRoute(pathname, searchParams)) {
                return;
            }

            const currentPage = parsePositivePage(
                searchParams.get(STOCK_ITEMS_PAGE_QUERY_KEY),
            );
            if (currentPage === nextPage) return;

            router.push(createStockDashboardUrl(searchParams, {
                [STOCK_ITEMS_PAGE_QUERY_KEY]: String(nextPage),
            }), {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
    );

    const setSearchQuery = useCallback(
        (value: string) => {
            setSearchQueryState(value);
            setItemsPageState(1);

            if (!isStockDashboardRoute(pathname, searchParams)) {
                return;
            }

            router.replace(createStockDashboardUrl(searchParams, {
                [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
                [STOCK_ITEMS_SEARCH_QUERY_KEY]: value.trim() || null,
            }), {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
    );

    const setSelectedCategoryId = useCallback(
        (categoryId: number | undefined) => {
            setSelectedCategoryIdState(categoryId);
            setItemsPageState(1);

            if (!isStockDashboardRoute(pathname, searchParams)) {
                return;
            }

            router.replace(createStockDashboardUrl(searchParams, {
                [STOCK_ITEMS_PAGE_QUERY_KEY]: "1",
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
                searchQuery,
                selectedCategoryId,
            }),
        [activeTab, itemsPage, searchQuery, selectedCategoryId],
    );

    const requestsQuery = useMemo(
        () =>
            buildStockRequestsQuery({
                activeTab,
                isAdmin,
                requestSearchQuery,
                requestsPage,
                statusFilter,
            }),
        [activeTab, isAdmin, requestSearchQuery, requestsPage, statusFilter],
    );

    const {
        data: categoriesData,
        isLoading: isCategoriesLoading,
        mutate: mutateCategories,
    } = useStockCategoriesQuery();
    const {
        data: itemsData,
        isLoading: isItemsLoading,
        mutate: mutateItems,
    } = useStockItemsQuery(itemsQuery);
    const {
        data: requestsData,
        isLoading: isRequestsLoading,
        mutate: mutateRequests,
    } = useStockRequestsQuery(requestsQuery);

    const refreshCategories = useCallback((): void => {
        void mutateCategories();
    }, [mutateCategories]);

    const refreshItems = useCallback((): void => {
        void mutateItems();
    }, [mutateItems]);

    const refreshRequests = useCallback((): void => {
        void mutateRequests();
    }, [mutateRequests]);

    useEffect(() => {
        setItemsPageState((prev) => (prev === 1 ? prev : 1));
    }, [searchQuery, selectedCategoryId]);

    useEffect(() => {
        if (!hasInitializedStatusFilterRef.current) {
            hasInitializedStatusFilterRef.current = true;
            return;
        }
        setRequestsPageState(1);

        const latestSearchParams = latestSearchParamsRef.current;

        if (!isStockDashboardRoute(pathname, latestSearchParams)) {
            return;
        }

        const currentPage = parsePositivePage(
            latestSearchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY),
        );
        if (currentPage === 1) {
            return;
        }

        router.push(createStockDashboardUrl(latestSearchParams, {
            [STOCK_REQUESTS_PAGE_QUERY_KEY]: "1",
        }), {
            scroll: false,
        });
    }, [pathname, requestSearchQuery, router, statusFilter]);

    useEffect(() => {
        const totalRequests = requestsData?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalRequests / STOCK_REQUESTS_LIMIT));
        if (requestsPage > totalPages) {
            void setRequestsPage(totalPages);
        }
    }, [requestsData?.total, requestsPage, setRequestsPage]);

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
    const isLoading =
        isCategoriesLoading ||
        isItemsLoading ||
        isRequestsLoading ||
        (!categoriesData && !itemsData && !requestsData);

    const dataValue: StockDataContextValue = useMemo(
        () => ({
            categories,
            items,
            requests,
            totalItems,
            totalRequests,
            isLoading,
            isAdmin,
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
