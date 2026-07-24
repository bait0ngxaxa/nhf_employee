import { prisma } from "@/lib/db/prisma";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { isAdminRole } from "@/lib/ssot/permissions";
import { assertCanCreateTicketWithPriority } from "@/lib/ssot/ticket-priority-policy";
import { TICKET_WITH_USERS_INCLUDE } from "./constants";
import {
    buildTicketStatusUpdate,
    isTicketStatusTransitionAllowed,
} from "./status-transitions";
import { auditTicketUpdate, createTicketAudit } from "./audit";
import {
    enqueueTicketCreatedOutbox,
    enqueueTicketUpdatedOutbox,
} from "./outbox";
import {
    assertMatchingTicketIdempotency,
    createTicketRequestHash,
} from "./idempotency";
import type {
    CreateTicketData,
    UpdateTicketData,
    UserContext,
    TicketWithRelations,
    PermissionCheck,
} from "./types";
import type { Prisma, Ticket } from "@prisma/client";

const TICKET_UPDATE_CONFLICT_MESSAGE =
    "Ticket was updated by another user";
const INVALID_TICKET_TRANSITION_MESSAGE = "Invalid ticket status transition";
const INVALID_TICKET_ASSIGNEE_MESSAGE =
    "Assignee must be an active admin";
const TICKET_CREATE_OPERATION = "TICKET_CREATE";

type CreateTicketOptions = {
    idempotencyKey: string;
};

type CreateTicketResult = {
    ticket: TicketWithRelations;
    replayed: boolean;
};

type CreateTicketCommand = {
    data: CreateTicketData;
    actor: UserContext;
    idempotencyKey: string;
    requestHash: string;
};

type TicketReplayClient = Pick<
    Prisma.TransactionClient,
    "ticket" | "ticketMutationIdempotency"
>;

async function findReplayedTicket(
    client: TicketReplayClient,
    actorId: number,
    idempotencyKey: string,
    requestHash: string,
): Promise<TicketWithRelations | null> {
    const record = await client.ticketMutationIdempotency.findUnique({
        where: {
            userId_idempotencyKey: { userId: actorId, idempotencyKey },
        },
    });
    if (!record) return null;

    assertMatchingTicketIdempotency(
        record,
        TICKET_CREATE_OPERATION,
        requestHash,
    );
    const ticket = await client.ticket.findUnique({
        where: { id: record.resourceId },
        include: TICKET_WITH_USERS_INCLUDE,
    });
    if (!ticket) {
        throw new Error("Idempotent ticket resource was not found");
    }
    return ticket as TicketWithRelations;
}

async function createTicketInTransaction(
    tx: Prisma.TransactionClient,
    command: CreateTicketCommand,
): Promise<CreateTicketResult> {
    const { actor, data, idempotencyKey, requestHash } = command;
    const replayedTicket = await findReplayedTicket(
        tx,
        actor.id,
        idempotencyKey,
        requestHash,
    );
    if (replayedTicket) {
        return { ticket: replayedTicket, replayed: true };
    }

    const newTicket = await tx.ticket.create({
        data: { ...data, reportedById: actor.id },
        include: TICKET_WITH_USERS_INCLUDE,
    });
    await enqueueTicketCreatedOutbox(tx, newTicket);
    await createTicketAudit(tx, "TICKET_CREATE", newTicket.id, actor, {
        after: {
            title: newTicket.title,
            description: newTicket.description,
            category: newTicket.category,
            priority: newTicket.priority,
            status: newTicket.status,
            reportedById: newTicket.reportedById,
        },
    });
    await tx.ticketMutationIdempotency.create({
        data: {
            userId: actor.id,
            idempotencyKey,
            operation: TICKET_CREATE_OPERATION,
            requestHash,
            resourceId: newTicket.id,
        },
    });

    return { ticket: newTicket as TicketWithRelations, replayed: false };
}

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
): Prisma.TicketUncheckedUpdateManyInput {
    const updateFields: Prisma.TicketUncheckedUpdateManyInput = {};

    // Only admins can change status, assignments, and priority
    if (permissions.isAdmin) {
        if (data.assignedToId !== undefined) {
            updateFields.assignedToId = data.assignedToId;
        }
        if (data.priority) updateFields.priority = data.priority;

        if (data.status) {
            Object.assign(
                updateFields,
                buildTicketStatusUpdate(
                    existingTicket.status,
                    data.status,
                    new Date(),
                ),
            );
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
    actor: UserContext,
    options: CreateTicketOptions,
): Promise<CreateTicketResult> {
    assertCanCreateTicketWithPriority(data.priority, actor.role);
    const requestHash = createTicketRequestHash(data);
    const command = {
        data,
        actor,
        idempotencyKey: options.idempotencyKey,
        requestHash,
    };

    try {
        return await runSerializableTransaction((tx) =>
            createTicketInTransaction(tx, command),
        );
    } catch (error) {
        if (!hasPrismaErrorCode(error, "P2002")) throw error;

        const ticket = await findReplayedTicket(
            prisma,
            actor.id,
            options.idempotencyKey,
            requestHash,
        );
        if (!ticket) throw error;
        return { ticket, replayed: true };
    }
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
    const existingTicket = await prisma.ticket.findFirst({
        where: { id: ticketId, deletedAt: null },
    });

    if (!existingTicket) {
        return { ticket: null, error: "Ticket not found", status: 404 };
    }

    // Check permissions
    const permissions = checkPermissions(existingTicket, user);
    if (!permissions.hasAccess) {
        return { ticket: null, error: "Access denied", status: 403 };
    }

    if (
        permissions.isAdmin
        && data.status
        && !isTicketStatusTransitionAllowed(existingTicket.status, data.status)
    ) {
        return {
            ticket: null,
            error: INVALID_TICKET_TRANSITION_MESSAGE,
            status: 409,
        };
    }

    const updateFields = buildUpdateFields(data, existingTicket, permissions);

    const result = await prisma.$transaction(async (tx) => {
        if (
            permissions.isAdmin
            && data.assignedToId !== undefined
            && data.assignedToId !== null
        ) {
            const assignee = await tx.user.findFirst({
                where: {
                    id: data.assignedToId,
                    role: "ADMIN",
                    isActive: true,
                    deletedAt: null,
                },
                select: { id: true },
            });

            if (!assignee) {
                return { kind: "invalid-assignee" } as const;
            }
        }

        const updateResult = await tx.ticket.updateMany({
            where: {
                id: ticketId,
                status: existingTicket.status,
                updatedAt: existingTicket.updatedAt,
                deletedAt: null,
            },
            data: updateFields,
        });

        if (updateResult.count === 0) {
            return { kind: "conflict" } as const;
        }

        const updatedTicket = await tx.ticket.findFirstOrThrow({
            where: { id: ticketId, deletedAt: null },
            include: TICKET_WITH_USERS_INCLUDE,
        });

        await auditTicketUpdate(tx, existingTicket, updatedTicket, user);

        // Add to outbox only if status was changed
        if (
            updateFields.status &&
            updateFields.status !== existingTicket.status
        ) {
            await enqueueTicketUpdatedOutbox(
                tx,
                updatedTicket,
                existingTicket.status,
            );
        }

        return { kind: "updated", ticket: updatedTicket } as const;
    });

    if (result.kind === "invalid-assignee") {
        return {
            ticket: null,
            error: INVALID_TICKET_ASSIGNEE_MESSAGE,
            status: 422,
        };
    }

    if (result.kind === "conflict") {
        return {
            ticket: null,
            error: TICKET_UPDATE_CONFLICT_MESSAGE,
            status: 409,
        };
    }

    return {
        ticket: result.ticket as TicketWithRelations,
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
    deleteReason: string,
    user: UserContext,
): Promise<{ success: boolean; error?: string; status?: number }> {
    // Admin only check
    if (!isAdminRole(user.role)) {
        return { success: false, error: "Unauthorized access", status: 403 };
    }

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findFirst({
        where: { id: ticketId, deletedAt: null },
    });

    if (!existingTicket) {
        return { success: false, error: "Ticket not found", status: 404 };
    }

    const deletedAt = new Date();
    const deleted = await prisma.$transaction(async (tx) => {
        const result = await tx.ticket.updateMany({
            where: {
                id: ticketId,
                deletedAt: null,
                updatedAt: existingTicket.updatedAt,
            },
            data: {
                deletedAt,
                deletedById: user.id,
                deleteReason,
            },
        });

        if (result.count === 0) return false;

        await createTicketAudit(tx, "TICKET_DELETE", ticketId, user, {
            before: {
                title: existingTicket.title,
                description: existingTicket.description,
                category: existingTicket.category,
                priority: existingTicket.priority,
                status: existingTicket.status,
                assignedToId: existingTicket.assignedToId,
                deletedAt: existingTicket.deletedAt,
            },
            after: {
                deletedAt,
                deletedById: user.id,
                deleteReason,
            },
        });

        return true;
    });

    if (!deleted) {
        return {
            success: false,
            error: TICKET_UPDATE_CONFLICT_MESSAGE,
            status: 409,
        };
    }

    return { success: true };
}

