import { Role, type Prisma, type Ticket } from "@prisma/client";
import {
    buildTicketUpdatedNotificationSnapshot,
} from "./update-notification-snapshot";
import type { TicketWithRelations } from "./types";

type TicketOutboxSnapshot = Pick<
    Ticket,
    "id" | "priority" | "reportedById" | "updatedAt"
>;

type TicketCommentOutboxInput = {
    ticketId: number;
    commentId: number;
    recipientIds: readonly number[];
    authorId: number;
    authorName: string;
    ticketTitle: string;
    authorIsOwner: boolean;
};

type TicketCommentRecipientInput = {
    reportedById: number;
    assignedToId: number | null;
    actorId: number;
    isAdmin: boolean;
    isOwner: boolean;
};

function ticketPayload(ticketId: number): string {
    return JSON.stringify({ ticketId });
}

export async function enqueueTicketCreatedOutbox(
    tx: Prisma.TransactionClient,
    ticket: TicketOutboxSnapshot,
): Promise<void> {
    const payload = ticketPayload(ticket.id);
    const data: Prisma.NotificationOutboxCreateManyInput[] = [
        {
            type: "TICKET_CREATED_IN_APP",
            payload,
            eventKey: `ticket:${ticket.id}:created:in-app:admins`,
        },
        {
            type: "TICKET_CREATED_LINE",
            payload,
            eventKey: `ticket:${ticket.id}:created:line:it`,
        },
        {
            type: "TICKET_CREATED_EMAIL_REPORTER",
            payload,
            eventKey: `ticket:${ticket.id}:created:email:reporter:${ticket.reportedById}`,
        },
    ];

    if (ticket.priority === "HIGH" || ticket.priority === "URGENT") {
        data.push({
            type: "TICKET_CREATED_EMAIL_IT",
            payload,
            eventKey: `ticket:${ticket.id}:created:email:it`,
        });
    }

    await tx.notificationOutbox.createMany({ data, skipDuplicates: true });
}

export async function enqueueTicketUpdatedOutbox(
    tx: Prisma.TransactionClient,
    ticket: TicketWithRelations,
    oldStatus: Ticket["status"],
): Promise<void> {
    const payload = JSON.stringify(
        buildTicketUpdatedNotificationSnapshot(ticket, oldStatus),
    );
    const eventPrefix = `ticket:${ticket.id}:status:${ticket.updatedAt.toISOString()}`;

    await tx.notificationOutbox.createMany({
        data: [
            {
                type: "TICKET_UPDATED_IN_APP_REPORTER",
                payload,
                eventKey: `${eventPrefix}:in-app:reporter:${ticket.reportedById}`,
            },
            {
                type: "TICKET_UPDATED_EMAIL_REPORTER",
                payload,
                eventKey: `${eventPrefix}:email:reporter:${ticket.reportedById}`,
            },
            {
                type: "TICKET_UPDATED_LINE",
                payload,
                eventKey: `${eventPrefix}:line:it`,
            },
        ],
        skipDuplicates: true,
    });
}

export async function enqueueTicketCommentOutbox(
    tx: Prisma.TransactionClient,
    input: TicketCommentOutboxInput,
): Promise<void> {
    const data: Prisma.NotificationOutboxCreateManyInput[] =
        input.recipientIds.map((recipientId) => ({
            type: "TICKET_COMMENT_IN_APP",
            payload: JSON.stringify({
                ticketId: input.ticketId,
                commentId: input.commentId,
                recipientId,
                authorId: input.authorId,
                authorName: input.authorName,
                ticketTitle: input.ticketTitle,
                authorIsOwner: input.authorIsOwner,
            }),
            eventKey: `ticket:${input.ticketId}:comment:${input.commentId}:in-app:user:${recipientId}`,
        }));

    if (data.length > 0) {
        await tx.notificationOutbox.createMany({ data, skipDuplicates: true });
    }
}

export async function getTicketCommentRecipientIds(
    tx: Prisma.TransactionClient,
    input: TicketCommentRecipientInput,
): Promise<number[]> {
    if (input.isAdmin && input.reportedById !== input.actorId) {
        return [input.reportedById];
    }
    if (!input.isOwner) return [];
    if (input.assignedToId) return [input.assignedToId];

    const admins = await tx.user.findMany({
        where: { role: Role.ADMIN },
        select: { id: true },
    });
    return admins.map((admin) => admin.id);
}
