import { z } from "zod";

import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import type { TicketWithRelations } from "./types";

export const ticketNotificationUserSchema = z.object({
    id: z.number().int().positive(),
    email: z.string().email(),
    name: z.string().min(1),
    department: z.string().min(1).optional(),
});

export const assignedTicketNotificationUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
});

export function buildTicketNotificationReportedBy(
    ticket: TicketWithRelations,
): z.infer<typeof ticketNotificationUserSchema> {
    return {
        id: ticket.reportedById,
        email: ticket.reportedBy.email,
        name: getEmployeeBackedUserDisplayName(ticket.reportedBy),
        department: ticket.reportedBy.employee?.dept?.name,
    };
}

export function buildTicketNotificationAssignedTo(
    ticket: TicketWithRelations,
): z.infer<typeof assignedTicketNotificationUserSchema> | undefined {
    if (!ticket.assignedTo) return undefined;

    return {
        name: getEmployeeBackedUserDisplayName(ticket.assignedTo),
        email: ticket.assignedTo.email,
    };
}
