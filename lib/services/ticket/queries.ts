import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isAdminRole } from "@/lib/ssot/permissions";
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
    TicketStatsResult,
} from "./types";

/**
 * Build Prisma where clause based on filters and user role
 */
function buildWhereClause(
    filters: TicketFilters,
    user: UserContext,
): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = { deletedAt: null };

    // Role-based filtering - non-admins only see their own tickets
    if (!isAdminRole(user.role)) {
        where.reportedById = user.id;
    }

    // Apply optional filters
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.priority) where.priority = filters.priority;
    if (filters.search && filters.search.trim().length > 0) {
        where.OR = [
            {
                title: {
                    contains: filters.search.trim(),
                },
            },
            {
                description: {
                    contains: filters.search.trim(),
                },
            },
            {
                reportedBy: {
                    is: {
                        OR: [
                            { name: { contains: filters.search.trim() } },
                            { email: { contains: filters.search.trim() } },
                            {
                                employee: {
                                    is: {
                                        OR: [
                                            { firstName: { contains: filters.search.trim() } },
                                            { lastName: { contains: filters.search.trim() } },
                                            { nickname: { contains: filters.search.trim() } },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            {
                assignedTo: {
                    is: {
                        OR: [
                            { name: { contains: filters.search.trim() } },
                            { email: { contains: filters.search.trim() } },
                            {
                                employee: {
                                    is: {
                                        OR: [
                                            { firstName: { contains: filters.search.trim() } },
                                            { lastName: { contains: filters.search.trim() } },
                                            { nickname: { contains: filters.search.trim() } },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        ];
    }

    return where;
}

/**
 * Get paginated list of tickets
 * @param filters - Query filters including pagination
 * @param user - Current user context for access control
 * Cached per request for deduplication
 */
export const getTickets = cache(
    async (
        filters: TicketFilters,
        user: UserContext,
    ): Promise<PaginatedTicketsResult> => {
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
    },
);

/**
 * Get aggregate statistics across the full ticket access scope.
 */
export async function getTicketStats(
    user: UserContext,
): Promise<TicketStatsResult> {
    const accessWhere: Prisma.TicketWhereInput = {
        deletedAt: null,
        ...(!isAdminRole(user.role) ? { reportedById: user.id } : {}),
    };
    const newTicketThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userTicketWhere: Prisma.TicketWhereInput = {
        deletedAt: null,
        ...(isAdminRole(user.role)
            ? { assignedToId: user.id }
            : { reportedById: user.id }),
    };

    const [
        total,
        statusGroups,
        priorityGroups,
        userTickets,
        newTickets,
    ] = await Promise.all([
        prisma.ticket.count({ where: accessWhere }),
        prisma.ticket.groupBy({
            by: ["status"],
            where: accessWhere,
            _count: { _all: true },
        }),
        prisma.ticket.groupBy({
            by: ["priority"],
            where: accessWhere,
            _count: { _all: true },
        }),
        prisma.ticket.count({ where: userTicketWhere }),
        prisma.ticket.count({
            where: {
                ...accessWhere,
                createdAt: { gte: newTicketThreshold },
                views: { none: { userId: user.id } },
            },
        }),
    ]);

    const statusCounts = new Map(
        statusGroups.map((group) => [group.status, group._count._all]),
    );
    const priorityCounts = new Map(
        priorityGroups.map((group) => [group.priority, group._count._all]),
    );

    return {
        total,
        open: statusCounts.get("OPEN") ?? 0,
        inProgress: statusCounts.get("IN_PROGRESS") ?? 0,
        resolved: statusCounts.get("RESOLVED") ?? 0,
        closed: statusCounts.get("CLOSED") ?? 0,
        cancelled: statusCounts.get("CANCELLED") ?? 0,
        highPriority: priorityCounts.get("HIGH") ?? 0,
        urgentPriority: priorityCounts.get("URGENT") ?? 0,
        userTickets,
        newTickets,
    };
}

/**
 * Get single ticket by ID with full details
 * @param ticketId - Ticket ID to fetch
 * @param user - Current user context for access control
 * @returns Ticket with relations or null if not found/no access
 * Cached per request for deduplication
 */
export const getTicketById = cache(
    async (
        ticketId: number,
        user: UserContext,
    ): Promise<{
        ticket: TicketWithRelations | null;
        error?: string;
        status?: number;
    }> => {
        const ticket = await prisma.ticket.findFirst({
            where: { id: ticketId, deletedAt: null },
            include: TICKET_DETAIL_INCLUDE,
        });

        if (!ticket) {
            return { ticket: null, error: "Ticket not found", status: 404 };
        }

        // Check permissions
        if (!isAdminRole(user.role) && ticket.reportedById !== user.id) {
            return { ticket: null, error: "Access denied", status: 403 };
        }

        return { ticket: ticket as TicketWithRelations };
    },
);

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
        where: { id: ticketId, deletedAt: null },
    });
    return count > 0;
}

