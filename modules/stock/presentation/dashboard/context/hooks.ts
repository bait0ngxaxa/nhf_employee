"use client";

import useSWR from "swr";
import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type {
    StockCategory,
    StockItem,
    StockRequest,
} from "./types";

type StockCategoriesResponse = {
    categories?: StockCategory[];
};

export type StockItemsResponse = {
    items?: StockItem[];
    total?: number;
};

export type StockRequestsResponse = {
    requests?: StockRequest[];
    total?: number;
};

export type StockQuerySuccess<TData> = (data: TData, key: string) => void;

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

export function useStockCategoriesQuery(enabled = true) {
    return useSWR<StockCategoriesResponse>(
        enabled ? API_ROUTES.stock.categories : null,
        apiGetFetcher,
        {
            ...DEFAULT_SWR_OPTIONS,
            dedupingInterval: 30_000,
        },
    );
}

export function useStockItemsQuery(
    query: string | null,
    onSuccess?: StockQuerySuccess<StockItemsResponse>,
) {
    return useSWR<StockItemsResponse>(query, apiGetFetcher, {
        ...DEFAULT_SWR_OPTIONS,
        dedupingInterval: 10_000,
        onSuccess,
    });
}

export function useStockRequestsQuery(
    query: string | null,
    onSuccess?: StockQuerySuccess<StockRequestsResponse>,
) {
    return useSWR<StockRequestsResponse>(query, apiGetFetcher, {
        ...DEFAULT_SWR_OPTIONS,
        dedupingInterval: 10_000,
        onSuccess,
    });
}
