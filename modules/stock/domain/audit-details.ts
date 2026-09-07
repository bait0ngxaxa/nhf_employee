import type { AuditAction } from "@prisma/client";

import type { AuditDetails } from "@/modules/audit";

export interface StockAttributeAuditSnapshot extends Record<string, unknown> {
    name: string;
    value: string;
}

export interface StockItemAuditSnapshot extends Record<string, unknown> {
    name: string;
    description: string | null;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    categoryId: number;
    categoryName?: string;
    isActive: boolean;
}

export interface StockVariantAuditSnapshot extends Record<string, unknown> {
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
    attributes: StockAttributeAuditSnapshot[];
}

export interface StockRequestLineAuditSnapshot extends Record<string, unknown> {
    itemId: number;
    itemName: string;
    sku: string;
    variantId: number;
    variantLabel?: string;
    quantity: number;
    unit: string;
    variantQuantityBefore?: number;
    variantQuantityAfter?: number;
}

export interface StockItemMutationAuditDetails extends AuditDetails {
    before?: StockItemAuditSnapshot | StockVariantAuditSnapshot;
    after?: StockItemAuditSnapshot | StockVariantAuditSnapshot;
    metadata?: Record<string, unknown> & {
        itemId: number;
        itemName?: string;
        itemSku?: string;
        variantId?: number;
        variantLabel?: string;
    };
}

export interface StockAdjustAuditDetails extends AuditDetails {
    before: Record<string, unknown> & {
        quantity: number;
        minStock: number;
        variantQuantity: number;
        variantMinStock: number;
    };
    after: Record<string, unknown> & {
        name: string;
        sku: string;
        quantity: number;
        minStock: number;
        variantQuantity: number;
        variantMinStock: number;
    };
    metadata: Record<string, unknown> & {
        itemId: number;
        itemName: string;
        itemSku: string;
        variantId: number;
        variantLabel: string;
        unit: string;
        adjustmentType: string;
        adjustmentQuantity: number;
        transactionIds: number[];
    };
}

interface StockRequestAuditMetadata extends Record<string, unknown> {
    stockRequestId: number;
    projectCode: string;
}

export interface StockRequestCreateAuditDetails extends AuditDetails {
    after: Record<string, unknown> & {
        status: string;
        itemCount: number;
        projectCode: string;
    };
    metadata: StockRequestAuditMetadata & {
        variantIds: number[];
        lines: StockRequestLineAuditSnapshot[];
        idempotencyKeyHash: string;
    };
}

export interface StockRequestIssueAuditDetails extends AuditDetails {
    before: Record<string, unknown> & { status: string };
    after: Record<string, unknown> & { status: string };
    metadata: StockRequestAuditMetadata & {
        variantIds: number[];
        transactionIds: number[];
        lines: StockRequestLineAuditSnapshot[];
    };
}

export interface StockRequestCancelAuditDetails extends AuditDetails {
    before: Record<string, unknown> & { status: string };
    after: Record<string, unknown> & { status: string };
    metadata: StockRequestAuditMetadata & { reason: string | null };
}

interface StockAuditDetailsByAction {
    STOCK_ITEM_CREATE: StockItemMutationAuditDetails;
    STOCK_ITEM_UPDATE: StockItemMutationAuditDetails;
    STOCK_ITEM_DELETE: StockItemMutationAuditDetails;
    STOCK_ADJUST: StockAdjustAuditDetails;
    STOCK_REQUEST_CREATE: StockRequestCreateAuditDetails;
    STOCK_REQUEST_ISSUE: StockRequestIssueAuditDetails;
    STOCK_REQUEST_CANCEL: StockRequestCancelAuditDetails;
}

export type StockContractedAuditAction = keyof StockAuditDetailsByAction & AuditAction;

export type StockAuditDetailsFor<Action extends StockContractedAuditAction> =
    StockAuditDetailsByAction[Action];

export function defineStockAuditDetails<Action extends StockContractedAuditAction>(
    _action: Action,
    details: StockAuditDetailsFor<Action>,
): StockAuditDetailsFor<Action> {
    return details;
}
