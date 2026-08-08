import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth/HybridAuthProvider";
import {
    useStockCategoriesQuery,
    useStockItemsQuery,
    useStockRequestsQuery,
} from "@/components/dashboard/context/stock/hooks";
import { StockProvider } from "@/components/dashboard/context/stock/StockProvider";
import { useStockUIContext } from "@/components/dashboard/context/stock/StockContext";
import { LIVE_SEARCH_DEBOUNCE_MS } from "@/constants/ui";

const navigationMocks = vi.hoisted(() => ({
    pathname: "/dashboard",
    router: {
        push: vi.fn(),
        replace: vi.fn(),
    },
    searchParams: new URLSearchParams(),
}));

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: vi.fn(),
}));

vi.mock("@/components/dashboard/context/stock/hooks", () => ({
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
        </>
    );
}

function capturedQueries(mock: ReturnType<typeof vi.fn>): string[] {
    return mock.mock.calls
        .map(([query]) => query)
        .filter((query): query is string => typeof query === "string");
}

describe("StockProvider live search", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        navigationMocks.pathname = "/dashboard";
        navigationMocks.searchParams = new URLSearchParams("tab=stock");

        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "7",
                role: "ADMIN",
                email: "admin@test.com",
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
            "tab=stock&stockItemsPage=5",
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
                `tab=stock&stockTab=${stockTab}&stockRequestsPage=5`,
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
            "tab=stock&stockSearch=old",
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
            "tab=stock&stockItemsPage=5",
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
});
