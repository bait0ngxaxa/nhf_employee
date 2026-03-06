import { emailService } from "@/lib/email";
import { lineNotificationService } from "@/lib/line";
import type { TicketEmailData } from "@/types/api";
import type { TicketWithRelations } from "./types";

function buildEmailData(ticket: TicketWithRelations): TicketEmailData {
    const reportedByName =
        ticket.reportedBy.employee?.firstName &&
        ticket.reportedBy.employee?.lastName
            ? `${ticket.reportedBy.employee.firstName} ${ticket.reportedBy.employee.lastName}`
            : ticket.reportedBy.name;

    const assignedToData = ticket.assignedTo
        ? {
              name:
                  ticket.assignedTo.employee?.firstName &&
                  ticket.assignedTo.employee?.lastName
                      ? `${ticket.assignedTo.employee.firstName} ${ticket.assignedTo.employee.lastName}`
                      : ticket.assignedTo.name,
              email: ticket.assignedTo.email,
          }
        : undefined;

    return {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        reportedBy: {
            name: reportedByName,
            email: ticket.reportedBy.email,
            department: ticket.reportedBy.employee?.dept?.name,
        },
        assignedTo: assignedToData,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt?.toISOString(),
    };
}

/**
 * Send notifications when a new ticket is created.
 * Throws on error so caller can mark outbox as FAILED.
 */
export async function sendTicketCreatedNotifications(
    ticket: TicketWithRelations,
): Promise<void> {
    const emailData = buildEmailData(ticket);

    if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
        await lineNotificationService.sendITTeamNotification(emailData);
    } else {
        await lineNotificationService.sendNewTicketNotification(emailData);
    }

    await emailService.sendNewTicketNotification(emailData);
    if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
        await emailService.sendITTeamNotification(emailData);
    }
}

/**
 * Send notifications when a ticket status is updated.
 * Throws on error so caller can mark outbox as FAILED.
 */
export async function sendTicketUpdatedNotifications(
    ticket: TicketWithRelations,
    oldStatus: string,
): Promise<void> {
    const emailData = buildEmailData(ticket);

    await emailService.sendStatusUpdateNotification(emailData, oldStatus);
    await lineNotificationService.sendStatusUpdateNotification(emailData);
}

