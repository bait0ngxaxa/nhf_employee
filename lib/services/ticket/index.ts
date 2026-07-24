// Re-export types
export type {
    TicketFilters,
    UserContext,
    CreateTicketData,
    UpdateTicketData,
    TicketWithRelations,
    TicketListItem,
    PaginatedTicketsResult,
    PermissionCheck,
    ServiceResult,
} from "./types";

// Import service functions
import {
    getTickets,
    getTicketById,
    recordTicketView,
    ticketExists,
} from "./queries";
import {
    createTicket,
    updateTicket,
    deleteTicket,
    checkPermissions,
} from "./mutations";
import { createTicketComment } from "./comments";

/**
 * Ticket Service Object
 * Provides all ticket-related operations
 */
export const ticketService = {
    // Query operations
    getTickets,
    getTicketById,
    recordTicketView,
    ticketExists,

    // Mutation operations
    createTicket,
    updateTicket,
    deleteTicket,
    checkPermissions,
    createTicketComment,
};

// Also export individual functions for tree-shaking
export {
    // Queries
    getTickets,
    getTicketById,
    recordTicketView,
    ticketExists,
    // Mutations
    createTicket,
    updateTicket,
    deleteTicket,
    checkPermissions,
    createTicketComment,
};
