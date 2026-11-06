export type StockHealth = "healthy" | "low" | "out";

/** Zero disables the positive low-stock band; zero availability is always out. */
export function classifyStockHealth(available: number, minimum: number): StockHealth {
    return available <= 0 ? "out" : minimum > 0 && available <= minimum ? "low" : "healthy";
}

export interface UnitQuantity { unit: string; quantity: number }
export interface AnalyticsMaterial {
    id: number; name: string; sku: string; category: string;
    requestCount: number; lineCount: number; quantities: UnitQuantity[];
    available: UnitQuantity[]; health: Record<StockHealth, number>;
}
export interface AnalyticsVariant {
    id: number; itemId: number; name: string; sku: string; attributes: string;
    unit: string; quantity: number; reserved: number; available: number; minimum: number;
    status: StockHealth;
}
export interface StockAnalyticsResponse {
    filters: { year: number; fromMonth: number; toMonth: number; categoryId?: number; projectCode?: string; metric: "frequency" | "quantity"; unit?: string };
    period: { start: string; end: string; timezone: "Asia/Bangkok" };
    kpis: { issuedRequests: number; issuedLines: number; pendingRequests: number; attentionVariants: number };
    topMaterials: AnalyticsMaterial[];
    categories: { id: number; name: string; lines: number; percentage: number }[];
    stockHealth: Record<StockHealth, number>;
    lowStock: AnalyticsVariant[];
    lowStockTotal: number;
    options: { categories: { id: number; name: string }[]; units: string[] };
    detail: { rows: { variantId: number | null; sku: string; attributes: string; unit: string; requests: number; quantity: number }[]; page: number; hasMore: boolean } | null;
    freshness: { generatedAt: string; snapshotScope: "current-all-active-variants" };
}
