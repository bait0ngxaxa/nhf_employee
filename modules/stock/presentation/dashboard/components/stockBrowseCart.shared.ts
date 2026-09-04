export const STOCK_PROJECT_CODE_MAX_LENGTH = 32;

export function normalizeStockProjectCode(value: string): string {
    return value.toUpperCase().replace(/\s+/g, "").slice(0, STOCK_PROJECT_CODE_MAX_LENGTH);
}
