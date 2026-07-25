import {
    TicketCategory,
    TicketPriority,
    TicketStatus,
} from "@prisma/client";
import { z } from "zod";

import type { TicketEmailData } from "@/types/api";
import {
    assignedTicketNotificationUserSchema,
    buildTicketNotificationAssignedTo,
    buildTicketNotificationReportedBy,
    ticketNotificationUserSchema,
} from "./notification-snapshot-common";
import type { TicketWithRelations } from "./types";

export const ticketCreatedNotificationSnapshotSchema = z.object({
    ticketId: z.number().int().positive(),
    title: z.string().min(1),
    description: z.string(),
    category: z.enum(TicketCategory),
    priority: z.enum(TicketPriority),
    status: z.enum(TicketStatus),
    reportedBy: ticketNotificationUserSchema,
    assignedTo: assignedTicketNotificationUserSchema.nullable(),
    createdAt: z.iso.datetime(),
});

export type TicketCreatedNotificationSnapshot = z.infer<
    typeof ticketCreatedNotificationSnapshotSchema
>;

export function buildTicketCreatedNotificationSnapshot(
    ticket: TicketWithRelations,
): TicketCreatedNotificationSnapshot {
    return {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        reportedBy: buildTicketNotificationReportedBy(ticket),
        assignedTo: buildTicketNotificationAssignedTo(ticket) ?? null,
        createdAt: ticket.createdAt.toISOString(),
    };
}

export function parseTicketCreatedNotificationSnapshot(
    payload: unknown,
): TicketCreatedNotificationSnapshot {
    const result = ticketCreatedNotificationSnapshotSchema.safeParse(payload);
    if (!result.success) {
        throw new Error("Invalid ticket created payload");
    }
    return result.data;
}

export function toTicketCreatedEmailData(
    snapshot: TicketCreatedNotificationSnapshot,
): TicketEmailData {
    return {
        ticketId: snapshot.ticketId,
        title: snapshot.title,
        description: snapshot.description,
        category: snapshot.category,
        priority: snapshot.priority,
        status: snapshot.status,
        reportedBy: snapshot.reportedBy,
        assignedTo: snapshot.assignedTo ?? undefined,
        createdAt: snapshot.createdAt,
    };
}
