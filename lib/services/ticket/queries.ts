import { prisma } from "@/lib/prisma";
import {
    getTicketListInclude,
    TICKET_DETAIL_INCLUDE,
    PAGINATION_DEFAULTS,
} from "./constants";
import type {
    TicketFilters,
    UserContext,
    PaginatedTicketsResult,
    TicketWithRelations,
    TicketListItem,
} from "./types";

/**
 * Build Prisma where clause based on filters and user role
 */
function buildWhereClause(
    filters: TicketFilters,
    user: UserContext,
): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    // Role-based filtering - non-admins only see their own tickets
    if (user.role !== "ADMIN") {
        where.reportedById = user.id;
    }

    // Apply optional filters
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.priority) where.priority = filters.priority;

    return where;
}

/**
 * Get paginated list of tickets
 * @param filters - Query filters including pagination
 * @param user - Current user context for access control
 */
export async function getTickets(
    filters: TicketFilters,
    user: UserContext,
): Promise<PaginatedTicketsResult> {
    const page = Math.max(1, filters.page || PAGINATION_DEFAULTS.page);
    const limit = Math.min(
        Math.max(1, filters.limit || PAGINATION_DEFAULTS.limit),
        PAGINATION_DEFAULTS.maxLimit,
    );
    const skip = (page - 1) * limit;

    const where = buildWhereClause(filters, user);

    const [tickets, totalCount] = await Promise.all([
        prisma.ticket.findMany({
            where,
            include: getTicketListInclude(user.id),
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            skip,
            take: limit,
        }),
        prisma.ticket.count({ where }),
    ]);

    return {
        tickets: tickets as TicketListItem[],
        pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
        },
    };
}

/**
 * Get single ticket by ID with full details
 * @param ticketId - Ticket ID to fetch
 * @param user - Current user context for access control
 * @returns Ticket with relations or null if not found/no access
 */
export async function getTicketById(
    ticketId: number,
    user: UserContext,
): Promise<{
    ticket: TicketWithRelations | null;
    error?: string;
    status?: number;
}> {
    const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: TICKET_DETAIL_INCLUDE,
    });

    if (!ticket) {
        return { ticket: null, error: "Ticket not found", status: 404 };
    }

    // Check permissions
    if (user.role !== "ADMIN" && ticket.reportedById !== user.id) {
        return { ticket: null, error: "Access denied", status: 403 };
    }

    return { ticket: ticket as TicketWithRelations };
}

/**
 * Record that a user has viewed a ticket
 */
export async function recordTicketView(
    ticketId: number,
    userId: number,
): Promise<void> {
    await prisma.ticketView.upsert({
        where: {
            ticketId_userId: {
                ticketId,
                userId,
            },
        },
        update: {
            viewedAt: new Date(),
        },
        create: {
            ticketId,
            userId,
        },
    });
}

/**
 * Check if a ticket exists
 */
export async function ticketExists(ticketId: number): Promise<boolean> {
    const count = await prisma.ticket.count({
        where: { id: ticketId },
    });
    return count > 0;
}
