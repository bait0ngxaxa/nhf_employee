export type {
    CancelRequestOptions,
    CreateStockItemInput,
    StockCommandActor,
    ItemVariantSeed,
    PendingRequestItemRecord,
} from "./types";

export type {
    LegacyRepairItemResult,
    LegacyRepairResult,
    LegacyRepairStatus,
    LegacyRepairSummary,
    StockRepairActor,
} from "./legacy-repair";

import {
    getCategories,
    getItems,
    getItemById,
    getRequests,
} from "./queries";
import {
    createCategory,
    deleteCategory,
    createItem,
    updateItem,
    adjustStock,
    createRequest,
    issueRequest,
    cancelRequest,
} from "./mutations";
import { repairLegacyStockItemVariants } from "./legacy-repair";

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
    createRequest,
    issueRequest,
    cancelRequest,
    repairLegacyStockItemVariants,
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
    createRequest,
    issueRequest,
    cancelRequest,
    repairLegacyStockItemVariants,
};
