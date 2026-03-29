"use client";

import useSWR from "swr";
import { API_ROUTES } from "@/lib/ssot/routes";
import type {
    StockCategory,
    StockItem,
    StockRequest,
} from "./types";

type StockCategoriesResponse = {
    categories?: StockCategory[];
};

type StockItemsResponse = {
    items?: StockItem[];
    total?: number;
};

type StockRequestsResponse = {
    requests?: StockRequest[];
    total?: number;
};

const DEFAULT_SWR_OPTIONS = {
    keepPreviousData: true,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
} as const;

async function jsonFetcher<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
}

export function useStockCategoriesQuery() {
    return useSWR<StockCategoriesResponse>(
        API_ROUTES.stock.categories,
        jsonFetcher,
        {
            ...DEFAULT_SWR_OPTIONS,
            dedupingInterval: 30_000,
        },
    );
}

export function useStockItemsQuery(query: string) {
    return useSWR<StockItemsResponse>(query, jsonFetcher, {
        ...DEFAULT_SWR_OPTIONS,
        dedupingInterval: 10_000,
    });
}

export function useStockRequestsQuery(query: string) {
    return useSWR<StockRequestsResponse>(query, jsonFetcher, {
        ...DEFAULT_SWR_OPTIONS,
        dedupingInterval: 10_000,
    });
}
