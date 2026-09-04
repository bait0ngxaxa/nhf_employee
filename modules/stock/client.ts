"use client";

export { StockSection } from "./presentation/dashboard/StockSection";
export { StockSectionSkeleton } from "./presentation/dashboard/components/StockSkeletons";
export { clearStockBrowseCart, useStockBrowseCart } from "./presentation/dashboard/components/useStockBrowseCart";
export {
    getBrowseCardImageUrl,
    getBrowseImageUrl,
    getItemAvailableQuantity,
    getPreferredVariant,
    getRequestItemDisplayName,
    getSelectableVariantCount,
    getVariantAttributeSummary,
    getVariantAvailableQuantity,
    hasSelectableVariants,
} from "./presentation/dashboard/components/stockVariant.shared";
export {
    STOCK_PROJECT_CODE_MAX_LENGTH,
    normalizeStockProjectCode,
} from "./presentation/dashboard/components/stockBrowseCart.shared";
export { formatStockRequestDate } from "./presentation/dashboard/components/stockRequest.shared";

export type {
    BrowseCartItem,
    StockBrowseItem,
    StockBrowseVariant,
    StockVariantAttributeValueLike,
} from "./presentation/dashboard/components/stockVariant.shared";
export type {
    StockCartAvailabilityReconciliation,
    StockCartVariantAvailability,
    StockRequestSubmitter,
} from "./presentation/dashboard/components/useStockBrowseCart";
