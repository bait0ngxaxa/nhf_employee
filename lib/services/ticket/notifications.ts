import { emailService } from "@/lib/email";
import { lineNotificationService } from "@/lib/line";
import {
    createAdminInAppNotificationsOnce,
    createInAppNotificationOnce,
} from "@/lib/services/notifications/in-app";
import { APP_ROUTES } from "@/lib/ssot/routes";
import type { TicketEmailData } from "@/types/api";
import type { TicketWithRelations } from "./types";

function getUserDisplayName(
    user: TicketWithRelations["reportedBy"],
): string {
    if (user.employee?.firstName && user.employee?.lastName) {
        return `${user.employee.firstName} ${user.employee.lastName}`;
    }

    return user.name;
}

function buildEmailData(ticket: TicketWithRelations): TicketEmailData {
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
            name: getUserDisplayName(ticket.reportedBy),
            email: ticket.reportedBy.email,
            department: ticket.reportedBy.employee?.dept?.name,
        },
        assignedTo: assignedToData,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt?.toISOString(),
    };
}

function getTicketActionUrl(ticketId: number): string {
    return `${APP_ROUTES.dashboard}?tab=it-support&ticketId=${ticketId}`;
}

async function assertDelivery(
    isSent: boolean,
    label: string,
): Promise<void> {
    if (!isSent) {
        throw new Error(`${label} notification failed`);
    }
}

async function createTicketCreatedInApp(
    ticket: TicketWithRelations,
): Promise<void> {
    await createAdminInAppNotificationsOnce({
        type: "TICKET_CREATED",
        title: "คำขอ IT Support ใหม่",
        message: `${getUserDisplayName(ticket.reportedBy)} แจ้ง "${ticket.title}" (ความสำคัญ: ${ticket.priority})`,
        actionUrl: getTicketActionUrl(ticket.id),
        referenceId: ticket.id.toString(),
        dedupeKeyPrefix: `ticket:${ticket.id}:TICKET_CREATED`,
    });
}

async function createTicketUpdatedInApp(
    ticket: TicketWithRelations,
    oldStatus: string,
): Promise<void> {
    await createInAppNotificationOnce({
        userId: ticket.reportedById,
        type: "TICKET_UPDATED",
        title: "สถานะคำขอ IT Support อัปเดต",
        message: `คำขอ "${ticket.title}" เปลี่ยนสถานะจาก ${oldStatus} เป็น ${ticket.status}`,
        actionUrl: getTicketActionUrl(ticket.id),
        referenceId: ticket.id.toString(),
        dedupeKey: `ticket:${ticket.reportedById}:TICKET_UPDATED:${ticket.id}:${oldStatus}:${ticket.status}`,
    });
}

/**
 * Send notifications when a new ticket is created.
 * Throws on error so caller can mark outbox as FAILED.
 */
export async function sendTicketCreatedNotifications(
    ticket: TicketWithRelations,
): Promise<void> {
    const emailData = buildEmailData(ticket);
    await createTicketCreatedInApp(ticket);

    if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
        await assertDelivery(
            await lineNotificationService.sendITTeamNotification(emailData),
            "TICKET_CREATED LINE",
        );
    } else {
        await assertDelivery(
            await lineNotificationService.sendNewTicketNotification(emailData),
            "TICKET_CREATED LINE",
        );
    }

    await assertDelivery(
        await emailService.sendNewTicketNotification(emailData),
        "TICKET_CREATED email",
    );

    if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
        await assertDelivery(
            await emailService.sendITTeamNotification(emailData),
            "TICKET_CREATED IT email",
        );
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
    await createTicketUpdatedInApp(ticket, oldStatus);

    await assertDelivery(
        await emailService.sendStatusUpdateNotification(emailData, oldStatus),
        "TICKET_UPDATED email",
    );
    await assertDelivery(
        await lineNotificationService.sendStatusUpdateNotification(emailData),
        "TICKET_UPDATED LINE",
    );
}
