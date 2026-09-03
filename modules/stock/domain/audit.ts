import type { AuditAction } from "@prisma/client";

export type StockAuditAction = Extract<
    AuditAction,
    | "STOCK_ADJUST"
    | "STOCK_ITEM_CREATE"
    | "STOCK_ITEM_UPDATE"
    | "STOCK_ITEM_DELETE"
    | "STOCK_CATEGORY_CREATE"
    | "STOCK_CATEGORY_DELETE"
    | "STOCK_REQUEST_CREATE"
    | "STOCK_REQUEST_ISSUE"
    | "STOCK_REQUEST_CANCEL"
>;

export type StockAuditEntityType =
    | "StockItem"
    | "StockVariant"
    | "StockRequest"
    | "StockCategory"
    | "StockAdjustment";

const STOCK_AUDIT_ENTITY_BY_ACTION = {
    STOCK_ADJUST: "StockAdjustment",
    STOCK_ITEM_CREATE: "StockItem",
    STOCK_ITEM_UPDATE: "StockItem",
    STOCK_ITEM_DELETE: "StockItem",
    STOCK_CATEGORY_CREATE: "StockCategory",
    STOCK_CATEGORY_DELETE: "StockCategory",
    STOCK_REQUEST_CREATE: "StockRequest",
    STOCK_REQUEST_ISSUE: "StockRequest",
    STOCK_REQUEST_CANCEL: "StockRequest",
} as const satisfies Record<StockAuditAction, StockAuditEntityType>;

export function getStockAuditEntityType(
    action: StockAuditAction,
): StockAuditEntityType {
    return STOCK_AUDIT_ENTITY_BY_ACTION[action];
}
