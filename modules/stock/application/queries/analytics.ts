import { readStockAnalytics } from "../../infrastructure/reports/analytics-query";
import type { StockAnalyticsResponse } from "../../domain/analytics";
import { stockAnalyticsQuerySchema } from "../../schemas/analytics";

export async function getStockAnalytics(input: unknown): Promise<StockAnalyticsResponse> {
    return readStockAnalytics(stockAnalyticsQuerySchema.parse(input));
}
