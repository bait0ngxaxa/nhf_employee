import type { CreateItemInput } from "@/lib/validations/stock";

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

export type PendingRequestItemRecord = {
    itemId: number;
    variantId: number | null;
    quantity: number;
};
