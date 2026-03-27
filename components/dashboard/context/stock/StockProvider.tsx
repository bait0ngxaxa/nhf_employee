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
import useSWR from "swr";
import { type StockRequestStatus } from "@prisma/client";
import { useSession } from "next-auth/react";
import { isAdminRole } from "@/lib/ssot/permissions";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import { StockDataContext, StockUIContext } from "./StockContext";
import type {
    StockCategory,
    StockItem,
    StockRequest,
    StockDataContextValue,
    StockUIContextValue,
} from "./types";

interface StockProviderProps {
    children: ReactNode;
}

interface StockCategoriesResponse {
    categories?: StockCategory[];
}

interface StockItemsResponse {
    items?: StockItem[];
    total?: number;
}

interface StockRequestsResponse {
    requests?: StockRequest[];
    total?: number;
}

const STOCK_TAB_QUERY_KEY = "stockTab";
const STOCK_REQUESTS_PAGE_QUERY_KEY = "stockRequestsPage";
const DASHBOARD_STOCK_MENU = "it-equipment";
const STOCK_DEFAULT_TAB = "browse";
const STOCK_ADMIN_TABS = new Set(["inventory", "admin-requests"]);
const STOCK_LIST_LIMIT = 20;

async function jsonFetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
    }
    return (await res.json()) as T;
}

function normalizeStockTab(tab: string | null, isAdmin: boolean): string {
    if (!tab) return STOCK_DEFAULT_TAB;
    if (!isAdmin && STOCK_ADMIN_TABS.has(tab)) return STOCK_DEFAULT_TAB;
    return tab;
}

function parsePositivePage(value: string | null): number {
    if (!value) return 1;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return 1;
    return parsed;
}

export function StockProvider({ children }: StockProviderProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const isAdmin = isAdminRole(session?.user?.role);

    const [activeTab, setActiveTabState] = useState(
        normalizeStockTab(searchParams.get(STOCK_TAB_QUERY_KEY), isAdmin),
    );
    const [itemsPage, setItemsPage] = useState(1);
    const [requestsPage, setRequestsPageState] = useState(
        parsePositivePage(searchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY)),
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState<
        number | undefined
    >();
    const [statusFilter, setStatusFilter] = useState<
        StockRequestStatus | undefined
    >();
    const hasInitializedStatusFilterRef = useRef(false);

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

    const setActiveTab = useCallback(
        (tab: string) => {
            const nextTab = normalizeStockTab(tab, isAdmin);
            setActiveTabState(nextTab);

            if (
                pathname !== APP_ROUTES.dashboard ||
                searchParams.get("tab") !== DASHBOARD_STOCK_MENU
            ) {
                return;
            }

            if (searchParams.get(STOCK_TAB_QUERY_KEY) === nextTab) {
                return;
            }

            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set("tab", DASHBOARD_STOCK_MENU);
            nextParams.set(STOCK_TAB_QUERY_KEY, nextTab);
            router.push(`${APP_ROUTES.dashboard}?${nextParams.toString()}`, {
                scroll: false,
            });
        },
        [isAdmin, pathname, router, searchParams],
    );

    const setRequestsPage = useCallback(
        (page: number) => {
            const nextPage = Number.isInteger(page) && page > 0 ? page : 1;
            setRequestsPageState(nextPage);

            if (
                pathname !== APP_ROUTES.dashboard ||
                searchParams.get("tab") !== DASHBOARD_STOCK_MENU
            ) {
                return;
            }

            const currentPage = parsePositivePage(
                searchParams.get(STOCK_REQUESTS_PAGE_QUERY_KEY),
            );
            if (currentPage === nextPage) return;

            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set("tab", DASHBOARD_STOCK_MENU);
            nextParams.set(STOCK_REQUESTS_PAGE_QUERY_KEY, String(nextPage));
            router.push(`${APP_ROUTES.dashboard}?${nextParams.toString()}`, {
                scroll: false,
            });
        },
        [pathname, router, searchParams],
    );

    const itemsQuery = useMemo(() => {
        const params = new URLSearchParams({
            page: String(itemsPage),
            limit: String(STOCK_LIST_LIMIT),
            activeOnly: "true",
        });
        if (searchQuery) params.set("search", searchQuery);
        if (selectedCategoryId !== undefined) {
            params.set("categoryId", String(selectedCategoryId));
        }
        return `${API_ROUTES.stock.items}?${params.toString()}`;
    }, [itemsPage, searchQuery, selectedCategoryId]);

    const requestsQuery = useMemo(() => {
        const params = new URLSearchParams({
            page: String(requestsPage),
            limit: String(STOCK_LIST_LIMIT),
        });
        if (statusFilter) params.set("status", statusFilter);
        return `${API_ROUTES.stock.requests}?${params.toString()}`;
    }, [requestsPage, statusFilter]);

    const {
        data: categoriesData,
        isLoading: isCategoriesLoading,
        mutate: mutateCategories,
    } = useSWR<StockCategoriesResponse>(
        API_ROUTES.stock.categories,
        jsonFetcher,
        {
            keepPreviousData: true,
            dedupingInterval: 30_000,
            revalidateOnFocus: false,
            shouldRetryOnError: false,
        },
    );

    const {
        data: itemsData,
        isLoading: isItemsLoading,
        mutate: mutateItems,
    } = useSWR<StockItemsResponse>(itemsQuery, jsonFetcher, {
        keepPreviousData: true,
        dedupingInterval: 10_000,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    });

    const {
        data: requestsData,
        isLoading: isRequestsLoading,
        mutate: mutateRequests,
    } = useSWR<StockRequestsResponse>(requestsQuery, jsonFetcher, {
        keepPreviousData: true,
        dedupingInterval: 10_000,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
    });

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
        setItemsPage((prev) => (prev === 1 ? prev : 1));
    }, [searchQuery, selectedCategoryId]);

    useEffect(() => {
        if (!hasInitializedStatusFilterRef.current) {
            hasInitializedStatusFilterRef.current = true;
            return;
        }
        void setRequestsPage(1);
    }, [setRequestsPage, statusFilter]);

    useEffect(() => {
        const totalRequests = requestsData?.total ?? 0;
        const totalPages = Math.max(1, Math.ceil(totalRequests / STOCK_LIST_LIMIT));
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
            selectedCategoryId,
            statusFilter,
            setRequestsPage,
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
