// Re-export types
export type {
    TicketFilters,
    UserContext,
    CreateTicketData,
    UpdateTicketData,
    TicketWithRelations,
    TicketListItem,
    PaginatedTicketsResult,
    TicketStatsResult,
    PermissionCheck,
    ServiceResult,
} from "./types";

// Import service functions
import {
    getTickets,
    getTicketStats,
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
    getTicketStats,
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
    getTicketStats,
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
