export interface StockRequestLineItemData {
    name: string;
    quantity: number;
    unit: string;
    variantLabel?: string;
}

export interface StockRequestLineData {
    requestId: number;
    projectCode: string;
    requesterName: string;
    note?: string | null;
    requestedAt: string;
    itemCount: number;
    totalQuantity: number;
    items: StockRequestLineItemData[];
}

export interface AggregateStockLowLineItemData {
    itemId: number;
    name: string;
    sku: string;
    quantity: number;
    minStock: number;
    unit: string;
}

export interface VariantStockLowLineItemData {
    itemId: number;
    variantId: number;
    itemName: string;
    variantSku: string;
    variantLabel: string;
    quantity: number;
    minStock: number;
    unit: string;
}

export type StockLowLineItemData =
    | AggregateStockLowLineItemData
    | VariantStockLowLineItemData;

export interface StockLowLineData {
    alertedAt: string;
    itemCount: number;
    items: StockLowLineItemData[];
}
