import {
    createCategory,
    deleteCategory,
    createItem,
    updateItem,
    adjustStock,
    createRequest,
    issueRequest,
    cancelRequest,
} from "./application/mutations";
import {
    getCategories,
    getItems,
    getItemById,
    getRequestById,
    getRequests,
    getVariantAvailability,
} from "./application/queries/queries";

export const stockService = {
    getCategories,
    createCategory,
    deleteCategory,
    getItems,
    getItemById,
    createItem,
    updateItem,
    adjustStock,
    getRequests,
    getRequestById,
    createRequest,
    issueRequest,
    cancelRequest,
    getVariantAvailability,
};

export {
    getCategories,
    createCategory,
    deleteCategory,
    getItems,
    getItemById,
    createItem,
    updateItem,
    adjustStock,
    getRequests,
    getRequestById,
    getVariantAvailability,
    createRequest,
    issueRequest,
    cancelRequest,
};

export {
    createCategorySchema,
    createItemSchema,
    updateItemSchema,
    adjustStockSchema,
    idempotencyKeySchema,
    createRequestSchema,
    issueRequestSchema,
    cancelRequestSchema,
    stockRequestIdParamSchema,
    stockVariantAvailabilityQuerySchema,
    stockReviewActionSchema,
    stockItemsFilterSchema,
    stockRequestsFilterSchema,
    stockReportExportQuerySchema,
} from "./schemas/stock";

export type {
    AdjustStockInput,
    CancelRequestInput,
    CreateCategoryInput,
    CreateItemInput,
    CreateRequestInput,
    IssueRequestInput,
    StockItemsFilter,
    StockReportExportQuery,
    StockRequestsFilter,
    StockRequestIdParam,
    StockReviewActionInput,
    StockVariantAvailabilityQuery,
    UpdateItemInput,
} from "./schemas/stock";

export {
    StockRequestIdempotencyConflictError,
    omitStockRequestIdempotency,
} from "./application/requests/request-idempotency";

export {
    executeCancelStockRequest,
    executeIssueStockRequest,
} from "./application/requests/stock-request-commands";

export { createStockCommandActor } from "./presentation/stock-command-actor";
export {
    assertStockCapabilityForMigration,
    buildStockAuthorizationActor,
    buildStockAuthorizationContext,
    canResolveStockCapabilityForMigration,
    getStockPresentationCapabilities,
    resolveStockCapabilityForMigration,
    resolveStockCapabilityInTransaction,
    STOCK_MIGRATED_CAPABILITIES,
} from "./application/authorization";
export type { StockPresentationCapabilities } from "./application/types";
export type {
    StockAuthorizationChannel,
    StockAuthorizationActor,
    StockAuthorizationContext,
    StockAuthorizedCommandActor,
    StockCapabilityAuthorization,
    StockCapabilityOptions,
    StockMigratedCapability,
    StockRequestQueryAuthorization,
} from "./application/authorization";
export { StockCapabilityDeniedError } from "./application/errors";
export {
    enforceStockJsonBodySize,
    readStockJsonBody,
    STOCK_JSON_MUTATION_MAX_BYTES,
} from "./presentation/stock-api";
export { requireLiffStockProcessorSession } from "./presentation/liff-stock-auth";

export {
    toLiffStockCatalogItem,
    toLiffStockCatalogResponse,
    toLiffStockCategory,
    toLiffStockRequestDetail,
    toLiffStockRequestsResponse,
    toLiffStockRequestSummary,
} from "./presentation/liff-serialization";
export {
    buildStockLiffRequestUrl,
    buildStockLiffUrl,
} from "./presentation/liff-links";
export type { StockLiffAction } from "./presentation/liff-links";

export {
    createStockBalanceReportXlsxResponse,
    getStockBalanceReportMeta,
} from "./infrastructure/reports/balance-export";
export {
    createStockRequestReportXlsxResponse,
    getStockRequestReportMeta,
    getStockRequestReportYears,
} from "./infrastructure/reports/report-export";
export { StockInvariantViolationError } from "./infrastructure/persistence/shared";

export {
    buildStockRequestResultLineEventKey,
    dispatchStockRequestResultLineOutbox,
    sendStockLowNotification,
    sendStockRequestNotification,
} from "./infrastructure/notifications/line-notifications";
export { dispatchStockOutbox } from "./infrastructure/notifications/outbox";
export {
    sendStockRequestResultNotification,
} from "./infrastructure/notifications/email";
export {
    notifyAdminsLowStockInApp,
    notifyAdminsStockRequestLineInApp,
} from "./infrastructure/notifications/notifications";
export {
    parseStockRequestResultEmailPayload,
    parseStockRequestResultLinePayload,
} from "./infrastructure/notifications/notification-payloads";
export type {
    StockRequestResultEmailPayload,
    StockRequestResultLinePayload,
    StockRequestResultStatus,
} from "./infrastructure/notifications/notification-payloads";

export {
    applyDefaultVariantBackfill,
    loadDefaultVariantBackfillReport,
} from "./application/maintenance/default-variant-backfill";
export {
    assertDefaultVariantApplyAuthorized,
    assertDefaultVariantReportSafeForApply,
    getDefaultVariantDatabaseTarget,
} from "./application/maintenance/default-variant-backfill-safety";
export type {
    DefaultVariantBackfillApplyResult,
    DefaultVariantBackfillReport,
} from "./application/maintenance/default-variant-backfill";
export {
    classifyStockInventoryAudit,
    determineAuditExitCode,
} from "./domain/inventory-audit";
export type {
    StockInventoryAuditResult,
    StockInventoryAuditSnapshot,
} from "./domain/inventory-audit";
