import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/modules/auth/client";
import {
    useStockCategoriesQuery,
    useStockItemsQuery,
    useStockRequestsQuery,
} from "./hooks";
import type { StockItemsResponse, StockRequestsResponse } from "./hooks";
import { StockProvider } from "./StockProvider";
import { useStockUIContext } from "./StockContext";
import { LIVE_SEARCH_DEBOUNCE_MS } from "@/constants/ui";

const navigationMocks = vi.hoisted(() => ({
    pathname: "/dashboard/stock",
    router: {
        push: vi.fn(),
        replace: vi.fn(),
    },
    searchParams: new URLSearchParams(),
}));

vi.mock("@/modules/auth/client", () => ({
    useAuth: vi.fn(),
}));

vi.mock("./hooks", () => ({
    useStockCategoriesQuery: vi.fn(),
    useStockItemsQuery: vi.fn(),
    useStockRequestsQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => navigationMocks.pathname,
    useRouter: () => navigationMocks.router,
    useSearchParams: () => navigationMocks.searchParams,
}));

function StockSearchProbe() {
    const {
        requestSearchQuery,
        searchQuery,
        setRequestSearchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        itemsPage,
        requestsPage,
    } = useStockUIContext();

    return (
        <>
            <input
                aria-label="item search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
            <input
                aria-label="request search"
                value={requestSearchQuery}
                onChange={(event) => setRequestSearchQuery(event.target.value)}
            />
            <output data-testid="items-page">{itemsPage}</output>
            <output data-testid="requests-page">{requestsPage}</output>
            <output data-testid="active-tab">{activeTab}</output>
            <button type="button" onClick={() => setActiveTab("browse")}>browse tab</button>
            <button type="button" onClick={() => setActiveTab("inventory")}>inventory tab</button>
        </>
    );
}

function capturedQueries(mock: ReturnType<typeof vi.fn>): string[] {
    return mock.mock.calls
        .map(([query]) => query)
        .filter((query): query is string => typeof query === "string");
}

function latestCapturedQuery(mock: ReturnType<typeof vi.fn>): string {
    const query = capturedQueries(mock).at(-1);
    if (!query) {
        throw new Error("Expected a Stock query");
    }
    return query;
}

function getQuerySuccess<TData>(
    calls: Array<[unknown, unknown]>,
    query: string,
): (data: TData, key: string) => void {
    const call = calls.find(([calledQuery]) => calledQuery === query);
    const callback = call?.[1];
    if (typeof callback !== "function") {
        throw new Error(`Expected a success callback for ${query}`);
    }
    return callback as (data: TData, key: string) => void;
}

const stockCapabilities = {
    canReadCatalog: true,
    canReadOwnRequests: true,
    canReadAllRequests: true,
    canCreateRequests: true,
    canCancelOwnRequests: true,
    canCancelAnyRequests: true,
    canProcessRequests: true,
    canManageInventory: true,
    canExportReports: true,
};

describe("StockProvider live search", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        navigationMocks.pathname = "/dashboard/stock";
        navigationMocks.searchParams = new URLSearchParams();

        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "7",
                role: "ADMIN",
                email: "admin@test.com",
                stockCapabilities,
            },
        } as never);
        vi.mocked(useStockCategoriesQuery).mockReturnValue({
            data: { categories: [] },
            isLoading: false,
            mutate: vi.fn(),
        } as never);
        vi.mocked(useStockItemsQuery).mockReturnValue({
            data: { items: [], total: 100 },
            isLoading: false,
            mutate: vi.fn(),
        } as never);
        vi.mocked(useStockRequestsQuery).mockReturnValue({
            data: { requests: [], total: 100 },
            isLoading: false,
            mutate: vi.fn(),
        } as never);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("updates item input immediately but debounces the API query and URL", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockItemsPage=5",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );
        expect(screen.getByTestId("items-page")).toHaveTextContent("5");
        expect(navigationMocks.router.replace).not.toHaveBeenCalled();
        vi.mocked(useStockItemsQuery).mockClear();

        const input = screen.getByRole("textbox", { name: "item search" });
        fireEvent.change(input, { target: { value: "k" } });
        fireEvent.change(input, { target: { value: "ke" } });
        fireEvent.change(input, { target: { value: "key" } });

        expect(input).toHaveValue("key");
        expect(screen.getByTestId("items-page")).toHaveTextContent("1");
        expect(capturedQueries(vi.mocked(useStockItemsQuery))).not.toEqual(
            expect.arrayContaining([expect.stringContaining("search=")]),
        );
        expect(navigationMocks.router.replace).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS);
        });

        const searchQueries = capturedQueries(vi.mocked(useStockItemsQuery))
            .filter((query) => query.includes("search="));
        expect(searchQueries).toHaveLength(1);
        expect(searchQueries[0]).toContain("search=key");
        expect(navigationMocks.router.replace).toHaveBeenCalledTimes(1);
        expect(navigationMocks.router.replace).toHaveBeenCalledWith(
            expect.stringContaining("stockSearch=key"),
            { scroll: false },
        );
    });

    it.each(["my-requests", "admin-requests"])(
        "debounces request queries on the %s tab",
        (stockTab) => {
            navigationMocks.searchParams = new URLSearchParams(
                `stockTab=${stockTab}&stockRequestsPage=5`,
            );
            render(
                <StockProvider>
                    <StockSearchProbe />
                </StockProvider>,
            );
            vi.mocked(useStockRequestsQuery).mockClear();

            const input = screen.getByRole("textbox", {
                name: "request search",
            });
            fireEvent.change(input, { target: { value: "k" } });
            fireEvent.change(input, { target: { value: "ke" } });
            fireEvent.change(input, { target: { value: "key" } });

            expect(input).toHaveValue("key");
            expect(screen.getByTestId("requests-page")).toHaveTextContent("1");
            expect(capturedQueries(vi.mocked(useStockRequestsQuery))).not.toEqual(
                expect.arrayContaining([expect.stringContaining("search=")]),
            );

            act(() => {
                vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS);
            });

            const searchQueries = capturedQueries(
                vi.mocked(useStockRequestsQuery),
            ).filter((query) => query.includes("search="));
            expect(searchQueries).toHaveLength(1);
            expect(searchQueries[0]).toContain("search=key");
        },
    );

    it("removes the item search parameter after a debounced clear", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockSearch=old",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        const input = screen.getByRole("textbox", { name: "item search" });
        expect(input).toHaveValue("old");
        fireEvent.change(input, { target: { value: "" } });

        act(() => {
            vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS - 1);
        });
        expect(navigationMocks.router.replace).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(navigationMocks.router.replace).toHaveBeenCalledTimes(1);
        const [url, options] = navigationMocks.router.replace.mock.calls[0];
        expect(new URL(url, "http://localhost").searchParams.has("stockSearch"))
            .toBe(false);
        expect(options).toEqual({ scroll: false });
    });

    it("persists the page reset when search returns to its original value", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockItemsPage=5",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        const input = screen.getByRole("textbox", { name: "item search" });
        fireEvent.change(input, { target: { value: "k" } });
        fireEvent.change(input, { target: { value: "" } });

        expect(screen.getByTestId("items-page")).toHaveTextContent("1");
        expect(navigationMocks.router.replace).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS);
        });

        expect(navigationMocks.router.replace).toHaveBeenCalledTimes(1);
        expect(navigationMocks.router.replace).toHaveBeenCalledWith(
            expect.stringContaining("stockItemsPage=1"),
            { scroll: false },
        );
    });

    it("clamps item pagination from the current response and keeps the clamp after growth", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockTab=browse&stockItemsPage=5",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(screen.getByTestId("items-page")).toHaveTextContent("5");
        const pageFiveQuery = latestCapturedQuery(vi.mocked(useStockItemsQuery));
        const pageFiveSuccess = getQuerySuccess<StockItemsResponse>(
            vi.mocked(useStockItemsQuery).mock.calls as unknown as Array<[unknown, unknown]>,
            pageFiveQuery,
        );

        act(() => {
            pageFiveSuccess({ items: [], total: 13 }, pageFiveQuery);
        });

        expect(screen.getByTestId("items-page")).toHaveTextContent("2");
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            expect.stringContaining("stockItemsPage=2"),
            { scroll: false },
        );

        const pageTwoQuery = latestCapturedQuery(vi.mocked(useStockItemsQuery));
        const pageTwoSuccess = getQuerySuccess<StockItemsResponse>(
            vi.mocked(useStockItemsQuery).mock.calls as unknown as Array<[unknown, unknown]>,
            pageTwoQuery,
        );
        act(() => {
            pageTwoSuccess({ items: [], total: 60 }, pageTwoQuery);
        });

        expect(screen.getByTestId("items-page")).toHaveTextContent("2");
    });

    it("keeps browse and inventory pages independent and rejects a stale browse response", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockTab=browse&stockItemsPage=4&stockInventoryPage=2",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        const browseQuery = latestCapturedQuery(vi.mocked(useStockItemsQuery));

        fireEvent.click(screen.getByRole("button", { name: "inventory tab" }));
        expect(screen.getByTestId("active-tab")).toHaveTextContent("inventory");
        expect(screen.getByTestId("items-page")).toHaveTextContent("2");
        const inventoryQuery = latestCapturedQuery(vi.mocked(useStockItemsQuery));
        expect(inventoryQuery).toContain("limit=10");

        const inventorySuccess = getQuerySuccess<StockItemsResponse>(
            vi.mocked(useStockItemsQuery).mock.calls as unknown as Array<[unknown, unknown]>,
            inventoryQuery,
        );
        act(() => {
            inventorySuccess({ items: [], total: 0 }, browseQuery);
        });
        expect(screen.getByTestId("items-page")).toHaveTextContent("2");

        act(() => {
            inventorySuccess({ items: [], total: 1 }, inventoryQuery);
        });
        expect(screen.getByTestId("items-page")).toHaveTextContent("1");

        fireEvent.click(screen.getByRole("button", { name: "browse tab" }));
        expect(screen.getByTestId("active-tab")).toHaveTextContent("browse");
        expect(screen.getByTestId("items-page")).toHaveTextContent("4");
    });

    it("clamps request pagination through the request URL contract and keeps it after growth", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockTab=my-requests&stockRequestsPage=5",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(screen.getByTestId("requests-page")).toHaveTextContent("5");
        const pageFiveQuery = latestCapturedQuery(vi.mocked(useStockRequestsQuery));
        const pageFiveSuccess = getQuerySuccess<StockRequestsResponse>(
            vi.mocked(useStockRequestsQuery).mock.calls as unknown as Array<[unknown, unknown]>,
            pageFiveQuery,
        );

        act(() => {
            pageFiveSuccess({ requests: [], total: 11 }, pageFiveQuery);
        });

        expect(screen.getByTestId("requests-page")).toHaveTextContent("2");
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            expect.stringContaining("stockRequestsPage=2"),
            { scroll: false },
        );

        const pageTwoQuery = latestCapturedQuery(vi.mocked(useStockRequestsQuery));
        const pageTwoSuccess = getQuerySuccess<StockRequestsResponse>(
            vi.mocked(useStockRequestsQuery).mock.calls as unknown as Array<[unknown, unknown]>,
            pageTwoQuery,
        );
        act(() => {
            pageTwoSuccess({ requests: [], total: 50 }, pageTwoQuery);
        });

        expect(screen.getByTestId("requests-page")).toHaveTextContent("2");
    });

    it("normalizes an unauthorized stale tab before building data queries", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockTab=inventory",
        );
        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "7",
                role: "USER",
                email: "user@test.com",
                stockCapabilities: {
                    ...stockCapabilities,
                    canReadCatalog: false,
                    canReadAllRequests: false,
                    canCreateRequests: false,
                    canCancelOwnRequests: false,
                    canCancelAnyRequests: false,
                    canProcessRequests: false,
                    canManageInventory: false,
                    canExportReports: false,
                },
            },
        } as never);

        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(vi.mocked(useStockItemsQuery)).toHaveBeenCalledWith(
            null,
            expect.any(Function),
        );
        expect(vi.mocked(useStockCategoriesQuery)).toHaveBeenCalledWith(false);
        expect(capturedQueries(vi.mocked(useStockRequestsQuery))).toEqual(
            expect.arrayContaining([expect.stringContaining("scope=mine")]),
        );
        expect(capturedQueries(vi.mocked(useStockRequestsQuery))).not.toEqual(
            expect.arrayContaining([expect.stringContaining("scope=all")]),
        );
    });

    it("does not query any Stock data for a report-only actor on a stale report URL", () => {
        navigationMocks.searchParams = new URLSearchParams("stockTab=reports");
        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "7",
                role: "USER",
                email: "user@test.com",
                stockCapabilities: {
                    ...stockCapabilities,
                    canReadCatalog: false,
                    canReadOwnRequests: false,
                    canReadAllRequests: false,
                    canCreateRequests: false,
                    canCancelOwnRequests: false,
                    canCancelAnyRequests: false,
                    canProcessRequests: false,
                    canManageInventory: false,
                    canExportReports: true,
                },
            },
        } as never);

        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(vi.mocked(useStockItemsQuery)).toHaveBeenCalledWith(
            null,
            expect.any(Function),
        );
        expect(vi.mocked(useStockRequestsQuery)).toHaveBeenCalledWith(
            null,
            expect.any(Function),
        );
        expect(vi.mocked(useStockCategoriesQuery)).toHaveBeenCalledWith(false);
    });
});
