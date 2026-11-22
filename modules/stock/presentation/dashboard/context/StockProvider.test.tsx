import {
    act,
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import { useLayoutEffect, useSyncExternalStore } from "react";
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
import { StockBrowseFilters } from "../components/StockBrowseFilters";

const ITEM_SEARCH_DELAY_MS = 500;

const navigationMocks = vi.hoisted(() => {
    let currentSearchParams = new URLSearchParams();
    const listeners = new Set<() => void>();

    const notify = () => {
        for (const listener of listeners) {
            listener();
        }
    };

    const setSearchParams = (
        value: string | URLSearchParams,
        shouldNotify = true,
    ) => {
        currentSearchParams = new URLSearchParams(value);
        if (shouldNotify) {
            notify();
        }
    };

    const writeBrowserUrl = window.history.replaceState.bind(window.history);
    const acknowledge = (url: string) => {
        setSearchParams(new URL(url, window.location.origin).searchParams);
    };
    const navigate = (url: string) => {
        writeBrowserUrl(null, "", url);
        acknowledge(url);
    };

    return {
        pathname: "/dashboard/stock",
        history: {
            push: vi.fn(navigate),
            replace: vi.fn(navigate),
        },
        acknowledge,
        writeBrowserUrl,
        get searchParams(): URLSearchParams {
            return currentSearchParams;
        },
        set searchParams(value: string | URLSearchParams) {
            writeBrowserUrl(null, "", `/dashboard/stock?${value}`);
            setSearchParams(value, false);
        },
        setExternalSearchParams(value: string | URLSearchParams, traversal = false) {
            writeBrowserUrl(null, "", `/dashboard/stock?${value}`);
            if (traversal) window.dispatchEvent(new PopStateEvent("popstate"));
            setSearchParams(value);
        },
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
});

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
    useSearchParams: () =>
        useSyncExternalStore(
            navigationMocks.subscribe,
            () => navigationMocks.searchParams,
            () => navigationMocks.searchParams,
        ),
}));

function StockSearchProbe() {
    const {
        requestSearchQuery,
        searchQuery,
        setRequestSearchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        navigateToInventory,
        itemsPage,
        setItemsPage,
        requestsPage,
        setRequestsPage,
        selectedCategoryId,
        setSelectedCategoryId,
    } = useStockUIContext();

    return (
        <>
            <StockBrowseFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                categories={[]}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
            />
            <input
                aria-label="request search"
                value={requestSearchQuery}
                onChange={(event) => setRequestSearchQuery(event.target.value)}
            />
            <output data-testid="items-page">{itemsPage}</output>
            <output data-testid="requests-page">{requestsPage}</output>
            <output data-testid="active-tab">{activeTab}</output>
            <output data-testid="category-id">{selectedCategoryId ?? "none"}</output>
            <button type="button" onClick={() => navigateToInventory("PAPER-A4")}>low stock inventory</button>
            <button type="button" onClick={() => setActiveTab("browse")}>browse tab</button>
            <button type="button" onClick={() => setActiveTab("inventory")}>inventory tab</button>
            <button type="button" onClick={() => setSelectedCategoryId(3)}>category three</button>
            <button type="button" onClick={() => setItemsPage(2)}>item page two</button>
            <button type="button" onClick={() => setItemsPage(3)}>item page three</button>
            <button type="button" onClick={() => setRequestsPage(2)}>request page two</button>
            <button type="button" onClick={() => setRequestsPage(3)}>request page three</button>
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
    canReadReports: false,
    canExportReports: true,
};

describe("StockProvider live search", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        vi.spyOn(window.history, "pushState").mockImplementation((_state, _title, url) => {
            if (url) navigationMocks.history.push(String(url));
        });
        vi.spyOn(window.history, "replaceState").mockImplementation((_state, _title, url) => {
            if (url) navigationMocks.history.replace(String(url));
        });
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
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it.each([
        "stockTab=reports",
        "stockTab=reports&stockCategoryId=99&stockSearch=old&source=alert",
        "stockTab=reports&stockCategoryId=99&stockInventoryPage=7&stockItemsPage=4&stockRequestsPage=3",
    ])("navigates from low stock with one canonical URL: %s", (initial) => {
        navigationMocks.searchParams = new URLSearchParams(initial);
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        fireEvent.click(screen.getByRole("button", { name: "low stock inventory" }));
        expect(navigationMocks.history.push).toHaveBeenCalledTimes(1);
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
        expect(screen.getByTestId("active-tab")).toHaveTextContent("inventory");
        expect(screen.getByRole("textbox", { name: "ค้นหาวัสดุ" })).toHaveValue("PAPER-A4");
        expect(screen.getByTestId("category-id")).toHaveTextContent("none");
        expect(screen.getByTestId("items-page")).toHaveTextContent("1");
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS * 2));
        expect(navigationMocks.searchParams.get("stockSearch")).toBe("PAPER-A4");
        expect(navigationMocks.searchParams.has("stockCategoryId")).toBe(false);
        expect(navigationMocks.searchParams.get("source")).toBe(new URLSearchParams(initial).get("source"));
        const query = new URL(latestCapturedQuery(vi.mocked(useStockItemsQuery)), "http://localhost");
        expect(query.searchParams.get("search")).toBe("PAPER-A4");
        expect(query.searchParams.get("page")).toBe("1");
        expect(query.searchParams.has("categoryId")).toBe(false);
        const destination = navigationMocks.searchParams.toString();
        // External URL changes model the browser's back/forward notifications.
        act(() => navigationMocks.setExternalSearchParams(initial));
        expect(screen.getByTestId("active-tab")).toHaveTextContent("reports");
        act(() => navigationMocks.setExternalSearchParams(destination));
        expect(screen.getByTestId("active-tab")).toHaveTextContent("inventory");
        expect(screen.getByRole("textbox", { name: "ค้นหาวัสดุ" })).toHaveValue("PAPER-A4");
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS * 2));
        expect(navigationMocks.history.push).toHaveBeenCalledTimes(1);
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
    });

    it("does not replay a debounced search draft over the inventory destination", () => {
        navigationMocks.searchParams = new URLSearchParams("stockTab=reports&stockSearch=old&stockCategoryId=8&stockInventoryPage=6");
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาวัสดุ" }), { target: { value: "stale draft" } });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS - 1));
        fireEvent.click(screen.getByRole("button", { name: "low stock inventory" }));
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS * 3));
        expect(navigationMocks.searchParams.get("stockSearch")).toBe("PAPER-A4");
        expect(navigationMocks.searchParams.get("stockInventoryPage")).toBe("1");
        expect(navigationMocks.history.push).toHaveBeenCalledTimes(1);
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
    });

    it("does not navigate to inventory without both inventory capabilities", () => {
        navigationMocks.searchParams = new URLSearchParams("stockTab=reports");
        vi.mocked(useAuth).mockReturnValue({ user: { stockCapabilities: { ...stockCapabilities, canManageInventory: false } } } as never);
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        fireEvent.click(screen.getByRole("button", { name: "low stock inventory" }));
        expect(navigationMocks.history.push).not.toHaveBeenCalled();
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
    });

    it.each(["browse", "inventory"])("keeps newer typing on %s when a search URL update is acknowledged late", (tab) => {
        navigationMocks.searchParams = new URLSearchParams({ stockTab: tab });
        let pendingUrl = "";
        navigationMocks.history.replace.mockImplementationOnce((url) => {
            pendingUrl = url;
            navigationMocks.writeBrowserUrl(null, "", url);
        });
        render(<StockProvider><StockSearchProbe /></StockProvider>);

        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "p" } });
        act(() => vi.advanceTimersByTime(110));
        fireEvent.change(input, { target: { value: "pa" } });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));
        expect(pendingUrl).toContain("stockSearch=pa");

        fireEvent.change(input, { target: { value: "pap" } });
        act(() => vi.advanceTimersByTime(200));
        fireEvent.change(input, { target: { value: "pape" } });
        act(() => navigationMocks.acknowledge(pendingUrl));
        expect(input).toHaveValue("pape");
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));
        expect(latestCapturedQuery(vi.mocked(useStockItemsQuery))).toContain("search=pape");
    });

    it("ignores out-of-order acknowledgements after newer search and filter changes", () => {
        const delayedUrls: string[] = [];
        const delayAcknowledgement = (url: string) => {
            delayedUrls.push(url);
            navigationMocks.writeBrowserUrl(null, "", url);
        };
        navigationMocks.history.replace.mockImplementationOnce(delayAcknowledgement);
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "pa" } });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));

        fireEvent.click(screen.getByRole("button", { name: "inventory tab" }));
        fireEvent.click(screen.getByRole("button", { name: "category three" }));
        navigationMocks.history.replace.mockImplementationOnce(delayAcknowledgement);
        fireEvent.change(input, { target: { value: "paper" } });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));

        expect(delayedUrls).toHaveLength(2);
        for (const url of delayedUrls.reverse()) {
            act(() => navigationMocks.acknowledge(url));
            expect(input).toHaveValue("paper");
            expect(screen.getByTestId("active-tab")).toHaveTextContent("inventory");
            expect(screen.getByTestId("category-id")).toHaveTextContent("3");
            expect(latestCapturedQuery(vi.mocked(useStockItemsQuery))).toContain("search=paper&categoryId=3");
        }
        expect(new URLSearchParams(window.location.search).get("stockSearch")).toBe("paper");
    });

    it("shows Thai IME composition immediately and searches only after composition ends", () => {
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: "กระดา" } });
        expect(input).toHaveValue("กระดา");
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS * 2));
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
        expect(latestCapturedQuery(vi.mocked(useStockItemsQuery))).not.toContain("search=");

        fireEvent.change(input, { target: { value: "กระดาษ" } });
        fireEvent.compositionEnd(input, { data: "กระดาษ" });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS - 1));
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        const query = new URL(latestCapturedQuery(vi.mocked(useStockItemsQuery)), window.location.origin);
        expect(query.searchParams.get("search")).toBe("กระดาษ");
        expect(navigationMocks.searchParams.get("stockSearch")).toBe("กระดาษ");
    });

    it("clears the draft while a previous search acknowledgement is pending", () => {
        let pendingUrl = "";
        navigationMocks.history.replace.mockImplementationOnce((url) => {
            pendingUrl = url;
            navigationMocks.writeBrowserUrl(null, "", url);
        });
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "pa" } });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));
        fireEvent.change(input, { target: { value: "paper" } });
        fireEvent.click(screen.getByRole("button", { name: "ล้างคำค้นหาวัสดุ" }));
        act(() => navigationMocks.acknowledge(pendingUrl));
        expect(input).toHaveValue("");

        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));
        expect(navigationMocks.searchParams.has("stockSearch")).toBe(false);
        const queries = capturedQueries(vi.mocked(useStockItemsQuery));
        expect(queries.some((query) => query.includes("search=paper"))).toBe(false);
        expect(queries.at(-1)).not.toContain("search=");
    });

    it("cancels pending edits when Back restores the same search on a different page", () => {
        navigationMocks.searchParams = "stockSearch=paper&stockItemsPage=2";
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "pen" } });
        act(() => {
            navigationMocks.setExternalSearchParams("stockSearch=paper&stockItemsPage=4", true);
            vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS);
        });
        expect(input).toHaveValue("paper");
        expect(screen.getByTestId("items-page")).toHaveTextContent("4");
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
    });

    it("ignores a previous search response when reconciling the current page", () => {
        navigationMocks.searchParams = "stockSearch=old&stockItemsPage=3";
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const oldKey = latestCapturedQuery(vi.mocked(useStockItemsQuery));
        fireEvent.change(screen.getByRole("textbox", { name: "ค้นหาวัสดุ" }), { target: { value: "paper" } });
        act(() => vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS));
        fireEvent.click(screen.getByRole("button", { name: "item page three" }));
        const calls = vi.mocked(useStockItemsQuery).mock.calls;
        const onSuccess = calls.at(-1)?.[1];
        expect(onSuccess).toBeTypeOf("function");
        act(() => onSuccess?.({ items: [], total: 0 }, oldKey));
        expect(screen.getByTestId("items-page")).toHaveTextContent("3");
        expect(navigationMocks.history.push).toHaveBeenCalledTimes(1);
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
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
        vi.mocked(useStockItemsQuery).mockClear();

        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "k" } });
        fireEvent.change(input, { target: { value: "ke" } });
        fireEvent.change(input, { target: { value: "key" } });

        expect(input).toHaveValue("key");
        expect(screen.getByTestId("items-page")).toHaveTextContent("1");
        expect(capturedQueries(vi.mocked(useStockItemsQuery))).not.toEqual(
            expect.arrayContaining([expect.stringContaining("search=")]),
        );
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS);
        });

        const searchQueries = capturedQueries(vi.mocked(useStockItemsQuery))
            .filter((query) => query.includes("search="));
        const uniqueSearchQueries = [...new Set(searchQueries)];
        expect(uniqueSearchQueries).toHaveLength(1);
        expect(uniqueSearchQueries[0]).toContain("search=key");
        expect(uniqueSearchQueries[0]).toContain("page=1");
        expect(navigationMocks.history.replace).toHaveBeenCalledTimes(1);
        expect(navigationMocks.history.replace).toHaveBeenCalledWith(
            expect.stringContaining("stockSearch=key"),
        );
    });

    it("uses the browser tab for consecutive navigation before React renders", () => {
        navigationMocks.searchParams = "stockTab=browse&stockItemsPage=4&stockInventoryPage=5";
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const browse = screen.getByRole("button", { name: "browse tab" });
        const inventory = screen.getByRole("button", { name: "inventory tab" });

        act(() => {
            fireEvent.click(browse);
            expect(navigationMocks.history.push).not.toHaveBeenCalled();
            fireEvent.click(inventory);
            expect(new URLSearchParams(window.location.search).get("stockTab")).toBe("inventory");
            expect(screen.getByTestId("active-tab")).toHaveTextContent("browse");
            fireEvent.click(inventory);
            fireEvent.click(browse);
        });

        const params = new URLSearchParams(window.location.search);
        expect(params.get("stockTab")).toBe("browse");
        expect(params.get("stockItemsPage")).toBe("4");
        expect(params.get("stockInventoryPage")).toBe("5");
        expect(screen.getByTestId("active-tab")).toHaveTextContent("browse");
        expect(navigationMocks.history.push).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["browse", "item", "items-page", "stockItemsPage"],
        ["inventory", "item", "items-page", "stockInventoryPage"],
        ["my-requests", "request", "requests-page", "stockRequestsPage"],
    ])("uses the browser page on %s for consecutive navigation before React renders", (tab, kind, pageOutput, pageKey) => {
        const initial = new URLSearchParams("stockItemsPage=7&stockInventoryPage=8&stockRequestsPage=9&stockCategoryId=4");
        initial.set("stockTab", tab);
        initial.set(pageKey, "2");
        navigationMocks.searchParams = initial;
        render(<StockProvider><StockSearchProbe /></StockProvider>);
        const pageTwo = screen.getByRole("button", { name: `${kind} page two` });
        const pageThree = screen.getByRole("button", { name: `${kind} page three` });

        act(() => {
            fireEvent.click(pageTwo);
            expect(navigationMocks.history.push).not.toHaveBeenCalled();
            fireEvent.click(pageThree);
            expect(new URLSearchParams(window.location.search).get(pageKey)).toBe("3");
            expect(screen.getByTestId(pageOutput)).toHaveTextContent("2");
            fireEvent.click(pageThree);
            fireEvent.click(pageTwo);
        });

        expect(new URLSearchParams(window.location.search)).toEqual(initial);
        expect(screen.getByTestId(pageOutput)).toHaveTextContent("2");
        expect(navigationMocks.history.push).toHaveBeenCalledTimes(2);
    });

    it("does not normalize a stale tab over navigation before the effect runs", () => {
        function NavigateOnMount() {
            const { activeTab, setActiveTab } = useStockUIContext();
            useLayoutEffect(() => setActiveTab("inventory"), [setActiveTab]);
            return <output>{activeTab}</output>;
        }

        navigationMocks.searchParams = "stockTab=unknown";
        render(<StockProvider><NavigateOnMount /></StockProvider>);

        expect(new URLSearchParams(window.location.search).get("stockTab")).toBe("inventory");
        expect(screen.getByText("inventory")).toBeInTheDocument();
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();
    });

    it("restores the canonical Stock tab from external URL changes while mounted", () => {
        navigationMocks.searchParams = new URLSearchParams("stockTab=browse");
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(screen.getByTestId("active-tab")).toHaveTextContent("browse");

        act(() => {
            navigationMocks.setExternalSearchParams("stockTab=inventory");
        });
        expect(screen.getByTestId("active-tab")).toHaveTextContent("inventory");

        act(() => {
            navigationMocks.setExternalSearchParams("stockTab=browse");
        });
        expect(screen.getByTestId("active-tab")).toHaveTextContent("browse");
    });

    it("keeps browse, inventory, and request pages on independent URL keys", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockTab=browse&stockItemsPage=4&stockInventoryPage=2&stockRequestsPage=5",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(screen.getByTestId("items-page")).toHaveTextContent("4");
        expect(screen.getByTestId("requests-page")).toHaveTextContent("5");

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockTab=inventory&stockItemsPage=4&stockInventoryPage=2&stockRequestsPage=5",
            );
        });
        expect(screen.getByTestId("items-page")).toHaveTextContent("2");
        expect(screen.getByTestId("requests-page")).toHaveTextContent("5");

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockTab=my-requests&stockItemsPage=4&stockInventoryPage=2&stockRequestsPage=3",
            );
        });
        expect(screen.getByTestId("requests-page")).toHaveTextContent("3");

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockTab=browse&stockItemsPage=6&stockInventoryPage=2&stockRequestsPage=3",
            );
        });
        expect(screen.getByTestId("items-page")).toHaveTextContent("6");
        expect(screen.getByTestId("requests-page")).toHaveTextContent("3");
    });

    it("reconciles the search draft from Back and Forward without losing immediate editing", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockSearch=paper&stockItemsPage=4",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        expect(input).toHaveValue("paper");
        fireEvent.change(input, { target: { value: "pen" } });
        expect(input).toHaveValue("pen");

        act(() => {
            vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS);
        });
        expect(navigationMocks.history.replace).toHaveBeenCalledWith(
            expect.stringContaining("stockSearch=pen"),
        );

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockSearch=paper&stockItemsPage=4&stockTab=browse",
                true,
            );
        });
        expect(input).toHaveValue("paper");

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockSearch=pen&stockItemsPage=1&stockTab=browse",
                true,
            );
        });
        expect(input).toHaveValue("pen");
    });

    it("keeps an in-progress search draft across unrelated URL changes", () => {
        navigationMocks.searchParams = new URLSearchParams("stockItemsPage=5");
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "pen" } });

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockTab=inventory&stockItemsPage=2",
            );
        });
        expect(input).toHaveValue("pen");
    });

    it("updates category through replace without resetting request pagination", () => {
        navigationMocks.searchParams = new URLSearchParams(
            "stockTab=browse&stockCategoryId=2&stockItemsPage=4&stockRequestsPage=6",
        );
        render(
            <StockProvider>
                <StockSearchProbe />
            </StockProvider>,
        );

        expect(screen.getByTestId("category-id")).toHaveTextContent("2");
        fireEvent.click(screen.getByRole("button", { name: "category three" }));

        expect(navigationMocks.history.replace).toHaveBeenCalledWith(
            expect.stringContaining("stockCategoryId=3"),
        );
        expect(screen.getByTestId("category-id")).toHaveTextContent("3");
        expect(screen.getByTestId("items-page")).toHaveTextContent("1");
        expect(screen.getByTestId("requests-page")).toHaveTextContent("6");

        act(() => {
            navigationMocks.setExternalSearchParams(
                "stockTab=browse&stockCategoryId=2&stockItemsPage=4&stockRequestsPage=6",
            );
        });
        expect(screen.getByTestId("category-id")).toHaveTextContent("2");
        expect(screen.getByTestId("items-page")).toHaveTextContent("4");
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

        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        expect(input).toHaveValue("old");
        fireEvent.change(input, { target: { value: "" } });

        act(() => {
            vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS - 1);
        });
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(navigationMocks.history.replace).toHaveBeenCalledTimes(1);
        const [url] = navigationMocks.history.replace.mock.calls[0];
        expect(new URL(url, "http://localhost").searchParams.has("stockSearch"))
            .toBe(false);
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

        const input = screen.getByRole("textbox", { name: "ค้นหาวัสดุ" });
        fireEvent.change(input, { target: { value: "k" } });
        fireEvent.change(input, { target: { value: "" } });

        expect(screen.getByTestId("items-page")).toHaveTextContent("1");
        expect(navigationMocks.history.replace).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(ITEM_SEARCH_DELAY_MS);
        });

        expect(navigationMocks.history.replace).toHaveBeenCalledTimes(1);
        expect(navigationMocks.history.replace).toHaveBeenCalledWith(
            expect.stringContaining("stockItemsPage=1"),
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
        expect(navigationMocks.history.push).toHaveBeenCalledWith(
            expect.stringContaining("stockItemsPage=2"),
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
        expect(navigationMocks.history.push).toHaveBeenCalledWith(
            expect.stringContaining("stockRequestsPage=2"),
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
                    canReadReports: false,
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
        expect(screen.getByTestId("active-tab")).toHaveTextContent("my-requests");
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
                    canReadReports: false,
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
