import {
    TicketCategory,
    TicketPriority,
    TicketStatus,
} from "@prisma/client";
import { z } from "zod";

import type { TicketEmailData } from "@/types/api";
import type { TicketWithRelations } from "./types";

const notificationUserSchema = z.object({
    id: z.number().int().positive(),
    email: z.string().email(),
    name: z.string().min(1),
    department: z.string().min(1).optional(),
});

const assignedUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
});

export const ticketUpdatedNotificationSnapshotSchema = z.object({
    ticketId: z.number().int().positive(),
    oldStatus: z.nativeEnum(TicketStatus),
    newStatus: z.nativeEnum(TicketStatus),
    title: z.string().min(1),
    description: z.string(),
    category: z.nativeEnum(TicketCategory),
    priority: z.nativeEnum(TicketPriority),
    reportedBy: notificationUserSchema,
    assignedTo: assignedUserSchema.optional(),
    createdAt: z.string().datetime(),
    occurredAt: z.string().datetime(),
});

export type TicketUpdatedNotificationSnapshot = z.infer<
    typeof ticketUpdatedNotificationSnapshotSchema
>;

function getDisplayName(
    user: {
        name: string;
        employee: {
            firstName: string;
            lastName: string;
        } | null;
    },
): string {
    if (user.employee?.firstName && user.employee?.lastName) {
        return `${user.employee.firstName} ${user.employee.lastName}`;
    }
    return user.name;
}

export function buildTicketUpdatedNotificationSnapshot(
    ticket: TicketWithRelations,
    oldStatus: TicketStatus,
): TicketUpdatedNotificationSnapshot {
    const assignedTo = ticket.assignedTo
        ? {
              name: getDisplayName(ticket.assignedTo),
              email: ticket.assignedTo.email,
          }
        : undefined;

    return {
        ticketId: ticket.id,
        oldStatus,
        newStatus: ticket.status,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        reportedBy: {
            id: ticket.reportedById,
            email: ticket.reportedBy.email,
            name: getDisplayName(ticket.reportedBy),
            department: ticket.reportedBy.employee?.dept?.name,
        },
        assignedTo,
        createdAt: ticket.createdAt.toISOString(),
        occurredAt: ticket.updatedAt.toISOString(),
    };
}

export function parseTicketUpdatedNotificationSnapshot(
    payload: unknown,
): TicketUpdatedNotificationSnapshot {
    const result = ticketUpdatedNotificationSnapshotSchema.safeParse(payload);
    if (!result.success) {
        throw new Error("Invalid ticket updated payload");
    }
    return result.data;
}

export function toTicketEmailData(
    snapshot: TicketUpdatedNotificationSnapshot,
): TicketEmailData {
    return {
        ticketId: snapshot.ticketId,
        title: snapshot.title,
        description: snapshot.description,
        category: snapshot.category,
        priority: snapshot.priority,
        status: snapshot.newStatus,
        reportedBy: snapshot.reportedBy,
        assignedTo: snapshot.assignedTo,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.occurredAt,
    };
}
