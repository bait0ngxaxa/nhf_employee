import type { CreateItemInput } from "@/lib/validations/stock";
import type { StockLowLineItemData } from "@/types/api";

export type CreateStockItemInput = Omit<CreateItemInput, "sku" | "categoryId"> & {
    sku?: string;
    categoryId?: number;
};

export type ItemVariantSeed = {
    id: number;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
};

export type CancelRequestOptions = {
    isAdmin: boolean;
};

export type StockCommandActor = {
    id: number;
    email: string;
    name: string;
    ipAddress?: string;
    userAgent?: string;
};

export type PendingRequestItemRecord = {
    itemId: number;
    variantId: number | null;
    quantity: number;
};

export type LowStockAlertCandidate = StockLowLineItemData;

export type AdjustStockResult = {
    itemId: number;
    variantId: number;
    itemName: string;
    sku: string;
    previousQty: number;
    newQty: number;
    previousMinStock: number;
    newMinStock: number;
    lowStockAlerts: LowStockAlertCandidate[];
};

export type IssueRequestResult<TRequest> = {
    request: TRequest;
    lowStockAlerts: LowStockAlertCandidate[];
};
