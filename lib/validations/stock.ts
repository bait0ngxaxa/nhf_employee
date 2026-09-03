/**
 * Client-facing type compatibility for the deferred Stock presentation layer.
 * Runtime Stock schemas are owned and exported by `@/modules/stock`.
 */
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
} from "@/modules/stock";
