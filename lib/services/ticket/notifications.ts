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
 * Send notifications when a new ticket is created
 * Sends LINE notification (IT team for high priority) and email notifications
 */
export async function sendTicketCreatedNotifications(
    ticket: TicketWithRelations,
): Promise<void> {
    try {
        const emailData = buildEmailData(ticket);

        // Send LINE notification (single notification - use IT team style for high priority)
        if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
            await lineNotificationService.sendITTeamNotification(emailData);
        } else {
            await lineNotificationService.sendNewTicketNotification(emailData);
        }

        // Send email notifications
        await emailService.sendNewTicketNotification(emailData);
        if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
            await emailService.sendITTeamNotification(emailData);
        }
    } catch (error) {
        console.error("❌ Failed to send ticket created notifications:", error);
        // Don't throw - notifications should not block ticket creation
    }
}

/**
 * Send notifications when a ticket status is updated
 */
export async function sendTicketUpdatedNotifications(
    ticket: TicketWithRelations,
    oldStatus: string,
): Promise<void> {
    try {
        const emailData = buildEmailData(ticket);

        await emailService.sendStatusUpdateNotification(emailData, oldStatus);
        await lineNotificationService.sendStatusUpdateNotification(emailData);
    } catch (error) {
        console.error("❌ Failed to send ticket update notifications:", error);
        // Don't throw - notifications should not block ticket update
    }
}
