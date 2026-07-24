import { emailService } from "@/lib/email";
import { lineNotificationService } from "@/lib/line";
import {
    createAdminInAppNotificationsOnce,
    createInAppNotificationOnce,
} from "@/lib/services/notifications/in-app";
import {
    createEmailMessageId,
    createLineRetryKey,
} from "@/lib/services/outbox/provider-key";
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

export async function sendTicketCreatedInAppNotification(
    ticket: TicketWithRelations,
    eventKey = `ticket:${ticket.id}:TICKET_CREATED`,
): Promise<void> {
    await createAdminInAppNotificationsOnce({
        type: "TICKET_CREATED",
        title: "คำขอ IT Support ใหม่",
        message: `${getUserDisplayName(ticket.reportedBy)} แจ้ง "${ticket.title}" (ความสำคัญ: ${ticket.priority})`,
        actionUrl: getTicketActionUrl(ticket.id),
        referenceId: ticket.id.toString(),
        dedupeKeyPrefix: eventKey,
    });
}
export async function sendTicketUpdatedInAppNotification(
    ticket: TicketWithRelations,
    oldStatus: string,
    eventKey = `ticket:${ticket.reportedById}:TICKET_UPDATED:${ticket.id}:${oldStatus}:${ticket.status}`,
): Promise<void> {
    await createInAppNotificationOnce({
        userId: ticket.reportedById,
        type: "TICKET_UPDATED",
        title: "สถานะคำขอ IT Support อัปเดต",
        message: `คำขอ "${ticket.title}" เปลี่ยนสถานะจาก ${oldStatus} เป็น ${ticket.status}`,
        actionUrl: getTicketActionUrl(ticket.id),
        referenceId: ticket.id.toString(),
        dedupeKey: eventKey,
    });
}
export async function sendTicketCreatedLineNotification(
    ticket: TicketWithRelations,
    eventKey?: string,
): Promise<void> {
    const emailData = buildEmailData(ticket);
    const isPriorityTicket =
        ticket.priority === "HIGH" || ticket.priority === "URGENT";
    const isSent = isPriorityTicket
        ? await lineNotificationService.sendITTeamNotification(
            emailData,
            eventKey ? createLineRetryKey(eventKey) : undefined,
        )
        : await lineNotificationService.sendNewTicketNotification(
            emailData,
            eventKey ? createLineRetryKey(eventKey) : undefined,
        );

    await assertDelivery(isSent, "TICKET_CREATED LINE");
}

export async function sendTicketCreatedReporterEmailNotification(
    ticket: TicketWithRelations,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await emailService.sendNewTicketNotification(
            buildEmailData(ticket),
            eventKey ? createEmailMessageId(eventKey) : undefined,
        ),
        "TICKET_CREATED reporter email",
    );
}

export async function sendTicketCreatedITEmailNotification(
    ticket: TicketWithRelations,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await emailService.sendITTeamNotification(
            buildEmailData(ticket),
            eventKey ? createEmailMessageId(eventKey) : undefined,
        ),
        "TICKET_CREATED IT email",
    );
}

export async function sendTicketUpdatedReporterEmailNotification(
    ticket: TicketWithRelations,
    oldStatus: string,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await emailService.sendStatusUpdateNotification(
            buildEmailData(ticket),
            oldStatus,
            eventKey ? createEmailMessageId(eventKey) : undefined,
        ),
        "TICKET_UPDATED reporter email",
    );
}

export async function sendTicketUpdatedLineNotification(
    ticket: TicketWithRelations,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await lineNotificationService.sendStatusUpdateNotification(
            buildEmailData(ticket),
            eventKey ? createLineRetryKey(eventKey) : undefined,
        ),
        "TICKET_UPDATED LINE",
    );
}

export type TicketCommentNotificationData = {
    ticketId: number;
    commentId: number;
    recipientId: number;
    authorId: number;
    authorName: string;
    ticketTitle: string;
    authorIsOwner: boolean;
};

export async function sendTicketCommentInAppNotification(
    input: TicketCommentNotificationData,
    eventKey: string,
): Promise<void> {
    await createInAppNotificationOnce({
        userId: input.recipientId,
        type: "NEW_COMMENT",
        title: input.authorIsOwner
            ? "ผู้แจ้งเพิ่มความคิดเห็นในคำขอ IT Support"
            : "มีความคิดเห็นใหม่ในคำขอ IT Support",
        message: `${input.authorName} แสดงความคิดเห็นในคำขอ "${input.ticketTitle}"`,
        actionUrl: getTicketActionUrl(input.ticketId),
        referenceId: input.ticketId.toString(),
        dedupeKey: eventKey,
    });
}
