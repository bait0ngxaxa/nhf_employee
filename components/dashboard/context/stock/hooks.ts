"use client";

import useSWR from "swr";
import { apiGet } from "@/lib/api-client";
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

async function apiGetFetcher<T>(url: string): Promise<T> {
    const response = await apiGet<T>(url);
    if (!response.success) {
        throw new Error(response.errorThai || response.error || "ไม่สามารถดึงข้อมูลได้");
    }

    return response.data;
}

export function useStockCategoriesQuery() {
    return useSWR<StockCategoriesResponse>(
        API_ROUTES.stock.categories,
        apiGetFetcher,
        {
            ...DEFAULT_SWR_OPTIONS,
            dedupingInterval: 30_000,
        },
    );
}

export function useStockItemsQuery(query: string) {
    return useSWR<StockItemsResponse>(query, apiGetFetcher, {
        ...DEFAULT_SWR_OPTIONS,
        dedupingInterval: 10_000,
    });
}

export function useStockRequestsQuery(query: string) {
    return useSWR<StockRequestsResponse>(query, apiGetFetcher, {
        ...DEFAULT_SWR_OPTIONS,
        dedupingInterval: 10_000,
    });
}
