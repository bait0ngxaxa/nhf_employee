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
import {
    toTicketCreatedEmailData,
    type TicketCreatedNotificationSnapshot,
} from "./created-notification-snapshot";
import {
    toTicketEmailData,
    type TicketUpdatedNotificationSnapshot,
} from "./update-notification-snapshot";

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
    snapshot: TicketCreatedNotificationSnapshot,
    eventKey = `ticket:${snapshot.ticketId}:TICKET_CREATED`,
): Promise<void> {
    await createAdminInAppNotificationsOnce({
        type: "TICKET_CREATED",
        title: "คำขอ IT Support ใหม่",
        message: `${snapshot.reportedBy.name} แจ้ง "${snapshot.title}" (ความสำคัญ: ${snapshot.priority})`,
        actionUrl: getTicketActionUrl(snapshot.ticketId),
        referenceId: snapshot.ticketId.toString(),
        dedupeKeyPrefix: eventKey,
    });
}
export async function sendTicketUpdatedInAppNotification(
    snapshot: TicketUpdatedNotificationSnapshot,
    eventKey = `ticket:${snapshot.reportedBy.id}:TICKET_UPDATED:${snapshot.ticketId}:${snapshot.oldStatus}:${snapshot.newStatus}`,
): Promise<void> {
    await createInAppNotificationOnce({
        userId: snapshot.reportedBy.id,
        type: "TICKET_UPDATED",
        title: "สถานะคำขอ IT Support อัปเดต",
        message: `คำขอ "${snapshot.title}" เปลี่ยนสถานะจาก ${snapshot.oldStatus} เป็น ${snapshot.newStatus}`,
        actionUrl: getTicketActionUrl(snapshot.ticketId),
        referenceId: snapshot.ticketId.toString(),
        dedupeKey: eventKey,
    });
}
export async function sendTicketCreatedLineNotification(
    snapshot: TicketCreatedNotificationSnapshot,
    eventKey?: string,
): Promise<void> {
    const emailData = toTicketCreatedEmailData(snapshot);
    const isPriorityTicket =
        snapshot.priority === "HIGH" || snapshot.priority === "URGENT";
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
    snapshot: TicketCreatedNotificationSnapshot,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await emailService.sendNewTicketNotification(
            toTicketCreatedEmailData(snapshot),
            eventKey ? createEmailMessageId(eventKey) : undefined,
        ),
        "TICKET_CREATED reporter email",
    );
}

export async function sendTicketCreatedITEmailNotification(
    snapshot: TicketCreatedNotificationSnapshot,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await emailService.sendITTeamNotification(
            toTicketCreatedEmailData(snapshot),
            eventKey ? createEmailMessageId(eventKey) : undefined,
        ),
        "TICKET_CREATED IT email",
    );
}

export async function sendTicketUpdatedReporterEmailNotification(
    snapshot: TicketUpdatedNotificationSnapshot,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await emailService.sendStatusUpdateNotification(
            toTicketEmailData(snapshot),
            snapshot.oldStatus,
            eventKey ? createEmailMessageId(eventKey) : undefined,
        ),
        "TICKET_UPDATED reporter email",
    );
}

export async function sendTicketUpdatedLineNotification(
    snapshot: TicketUpdatedNotificationSnapshot,
    eventKey?: string,
): Promise<void> {
    await assertDelivery(
        await lineNotificationService.sendStatusUpdateNotification(
            toTicketEmailData(snapshot),
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
