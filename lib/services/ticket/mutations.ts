import { OUTBOX_NOTIFICATION_TYPES } from "@/lib/services/outbox/types";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/ssot/permissions";
import { TICKET_WITH_USERS_INCLUDE } from "./constants";
import type {
    CreateTicketData,
    UpdateTicketData,
    UserContext,
    TicketWithRelations,
    PermissionCheck,
} from "./types";
import type { Ticket } from "@prisma/client";

/**
 * Check user permissions for a ticket
 */
export function checkPermissions(
    ticket: Ticket,
    user: UserContext,
): PermissionCheck {
    const isOwner = ticket.reportedById === user.id;
    const isAdmin = isAdminRole(user.role);
    const hasAccess = isOwner || isAdmin;

    return { isOwner, isAdmin, hasAccess };
}

/**
 * Build update fields based on permissions and ticket status
 */
function buildUpdateFields(
    data: UpdateTicketData,
    existingTicket: Ticket,
    permissions: PermissionCheck,
): Record<string, unknown> {
    const updateFields: Record<string, unknown> = {};

    // Only admins can change status, assignments, and priority
    if (permissions.isAdmin) {
        if (data.status) updateFields.status = data.status;
        if (data.assignedToId !== undefined) {
            updateFields.assignedToId = data.assignedToId;
        }
        if (data.priority) updateFields.priority = data.priority;

        // Handle resolvedAt timestamp
        if (data.status === "RESOLVED") {
            updateFields.resolvedAt = new Date();
        } else if (data.status && existingTicket.resolvedAt) {
            updateFields.resolvedAt = null;
        }
    }

    // Owners can edit title, description, category if ticket is still OPEN
    if (permissions.isOwner && existingTicket.status === "OPEN") {
        if (data.title) updateFields.title = data.title;
        if (data.description) updateFields.description = data.description;
        if (data.category) updateFields.category = data.category;
    }

    return updateFields;
}

/**
 * Create a new ticket
 * @param data - Validated ticket data
 * @param userId - ID of the user creating the ticket
 */
export async function createTicket(
    data: CreateTicketData,
    userId: number,
): Promise<TicketWithRelations> {
    const ticket = await prisma.$transaction(async (tx) => {
        const newTicket = await tx.ticket.create({
            data: {
                title: data.title,
                description: data.description,
                category: data.category,
                priority: data.priority,
                reportedById: userId,
            },
            include: TICKET_WITH_USERS_INCLUDE,
        });

        // Add to outbox for LINE/Email notifications
        await tx.notificationOutbox.create({
            data: {
                type: OUTBOX_NOTIFICATION_TYPES[0],
                payload: JSON.stringify({ ticketId: newTicket.id }),
            },
        });

        return newTicket;
    });

    return ticket as TicketWithRelations;
}

/**
 * Update an existing ticket
 * @param ticketId - ID of the ticket to update
 * @param data - Update data
 * @param user - Current user context for permission checks
 * @returns Updated ticket or error info
 */
export async function updateTicket(
    ticketId: number,
    data: UpdateTicketData,
    user: UserContext,
): Promise<{
    ticket: TicketWithRelations | null;
    oldStatus?: string;
    error?: string;
    status?: number;
}> {
    // Fetch existing ticket
    const existingTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
    });

    if (!existingTicket) {
        return { ticket: null, error: "Ticket not found", status: 404 };
    }

    // Check permissions
    const permissions = checkPermissions(existingTicket, user);
    if (!permissions.hasAccess) {
        return { ticket: null, error: "Access denied", status: 403 };
    }

    // Build and apply updates within transaction
    const updateFields = buildUpdateFields(data, existingTicket, permissions);

    const result = await prisma.$transaction(async (tx) => {
        const updatedTicket = await tx.ticket.update({
            where: { id: ticketId },
            data: updateFields,
            include: TICKET_WITH_USERS_INCLUDE,
        });

        // Add to outbox only if status was changed
        if (
            updateFields.status &&
            updateFields.status !== existingTicket.status
        ) {
            await tx.notificationOutbox.create({
                data: {
                    type: OUTBOX_NOTIFICATION_TYPES[1],
                    payload: JSON.stringify({
                        ticketId: updatedTicket.id,
                        oldStatus: existingTicket.status,
                    }),
                },
            });
        }

        return updatedTicket;
    });

    return {
        ticket: result as TicketWithRelations,
        oldStatus: existingTicket.status,
    };
}

/**
 * Delete a ticket (admin only)
 * @param ticketId - ID of the ticket to delete
 * @param user - Current user context (must be admin)
 */
export async function deleteTicket(
    ticketId: number,
    user: UserContext,
): Promise<{ success: boolean; error?: string; status?: number }> {
    // Admin only check
    if (!isAdminRole(user.role)) {
        return { success: false, error: "Unauthorized access", status: 403 };
    }

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
    });

    if (!existingTicket) {
        return { success: false, error: "Ticket not found", status: 404 };
    }

    // Delete ticket (comments will be deleted due to CASCADE)
    await prisma.ticket.delete({
        where: { id: ticketId },
    });

    return { success: true };
}

