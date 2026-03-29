export type {
    CancelRequestOptions,
    CreateStockItemInput,
    ItemVariantSeed,
    PendingRequestItemRecord,
} from "./types";

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
};
