"use client";

import useSWR, { type SWRResponse } from "swr";
import { apiGet } from "@/lib/client/api-client";
import type { StockAnalyticsResponse } from "../../../domain/analytics";

async function fetchAnalytics(url: string): Promise<StockAnalyticsResponse> {
    const response = await apiGet<StockAnalyticsResponse>(url);
    if (!response.success) throw new Error(response.errorThai || "โหลดภาพรวมวัสดุไม่สำเร็จ");
    return response.data;
}

export function useStockAnalytics(params: URLSearchParams): SWRResponse<StockAnalyticsResponse, Error> {
    return useSWR(`/api/stock/reports/analytics?${params}`, fetchAnalytics, {
        revalidateOnFocus: false, shouldRetryOnError: false, keepPreviousData: true,
    });
}
