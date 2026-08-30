import type { StockRequestStatus } from "@prisma/client";

export type LiffStockRequestAction = "CANCEL" | "ISSUE";
export type LiffStockViewerRole = "REQUESTER" | "PROCESSOR";

export interface LiffStockVariantAttributeValue {
    attributeValue: {
        value: string;
        attribute: { name: string };
    };
}

export interface LiffStockCatalogVariant {
    id: number;
    sku: string;
    unit: string;
    imageUrl: string | null;
    availableQuantity: number;
    attributeValues: LiffStockVariantAttributeValue[];
}

export interface LiffStockCatalogItem {
    id: number;
    name: string;
    description: string | null;
    imageUrl: string | null;
    sku: string;
    unit: string;
    availableQuantity: number;
    category: { id: number; name: string };
    variants: LiffStockCatalogVariant[];
}

export interface LiffStockCategory {
    id: number;
    name: string;
}

export interface LiffStockRequestItem {
    itemName: string;
    itemSku: string;
    variantSku: string | null;
    variantLabel: string | null;
    unit: string;
    quantity: number;
    imageUrl: string | null;
    currentQuantity: number | null;
    isAvailableForIssue: boolean;
}

export interface LiffStockRequestUser {
    name: string;
}

export interface LiffStockRequestSummary {
    id: number;
    projectCode: string;
    status: StockRequestStatus;
    note: string | null;
    cancelReason: string | null;
    issuedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    requester?: LiffStockRequestUser;
    items: LiffStockRequestItem[];
    availableActions: LiffStockRequestAction[];
}

export interface LiffStockRequestDetail extends LiffStockRequestSummary {
    viewerRole: LiffStockViewerRole;
}

export interface LiffStockCatalogResponse {
    items: LiffStockCatalogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface LiffStockRequestsResponse {
    requests: LiffStockRequestSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
