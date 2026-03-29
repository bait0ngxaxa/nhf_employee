import { type StockRequestStatus } from "@prisma/client";

export interface StockCategory {
    id: number;
    name: string;
    description: string | null;
    _count?: { items: number };
}

export interface StockItemCategory {
    id: number;
    name: string;
}

export interface StockItem {
    id: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    sku: string;
    unit: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minStock: number;
    categoryId: number;
    isActive: boolean;
    category: StockItemCategory;
    variants?: StockItemVariant[];
}

export interface StockItemVariantAttributeValue {
    attributeValue: {
        id: number;
        value: string;
        attribute: {
            id: number;
            name: string;
        };
    };
}

export interface StockItemVariant {
    id: number;
    stockItemId: number;
    sku: string;
    unit: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
    attributeValues?: StockItemVariantAttributeValue[];
}

export interface StockRequestItemDetail {
    id: number;
    itemId: number;
    variantId: number | null;
    quantity: number;
    item: { id: number; name: string; sku: string; unit: string };
    variant?: {
        id: number;
        sku: string;
        unit: string;
        imageUrl: string | null;
        attributeValues?: StockItemVariantAttributeValue[];
    } | null;
}

export interface StockRequest {
    id: number;
    requestedBy: number;
    status: StockRequestStatus;
    note: string | null;
    issuedById: number | null;
    issuedAt: string | null;
    cancelReason: string | null;
    cancelledById: number | null;
    cancelledAt: string | null;
    createdAt: string;
    requester: { id: number; name: string; email: string };
    issuer: { id: number; name: string } | null;
    canceller: { id: number; name: string } | null;
    items: StockRequestItemDetail[];
}

export interface StockDataContextValue {
    categories: StockCategory[];
    items: StockItem[];
    requests: StockRequest[];
    totalItems: number;
    totalRequests: number;
    isLoading: boolean;
    isAdmin: boolean;
    refreshItems: () => void;
    refreshRequests: () => void;
    refreshCategories: () => void;
}

export interface StockUIContextValue {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    itemsPage: number;
    setItemsPage: (page: number) => void;
    requestsPage: number;
    setRequestsPage: (page: number) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    selectedCategoryId: number | undefined;
    setSelectedCategoryId: (id: number | undefined) => void;
    statusFilter: StockRequestStatus | undefined;
    setStatusFilter: (s: StockRequestStatus | undefined) => void;
}
