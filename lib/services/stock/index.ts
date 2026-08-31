export type {
    CancelRequestOptions,
    CreateStockItemInput,
    StockCommandActor,
    ItemVariantSeed,
    PendingRequestItemRecord,
} from "./types";

import {
    getCategories,
    getItems,
    getItemById,
    getRequestById,
    getRequests,
    getVariantAvailability,
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
