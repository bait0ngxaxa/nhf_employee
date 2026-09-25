import type { ITTicketEventKind, ITTicketStatus, Prisma } from "@prisma/client";

type ITTicketNotificationReadContext = Pick<
    Prisma.TransactionClient,
    "iTTicket" | "iTTicketEvent" | "iTTicketComment"
>;

export interface ITTicketNotificationEventSource {
    readonly id: number;
    readonly ticketId: number;
    readonly actorUserId: number;
    readonly kind: ITTicketEventKind;
    readonly toStatus: ITTicketStatus | null;
    readonly toAssigneeUserId: number | null;
}

export interface ITTicketNotificationCommentSource {
    readonly id: string;
    readonly ticketId: number;
    readonly authorUserId: number;
    readonly kind: "REQUESTER" | "OPERATOR";
}

export interface ITTicketNotificationResourceState {
    readonly id: number;
    readonly requesterUserId: number;
    readonly assignedToUserId: number | null;
    readonly status: ITTicketStatus;
}

export function findITTicketNotificationEventSource(
    tx: ITTicketNotificationReadContext,
    eventId: number,
): Promise<ITTicketNotificationEventSource | null> {
    return tx.iTTicketEvent.findUnique({
        where: { id: eventId },
        select: {
            id: true,
            ticketId: true,
            actorUserId: true,
            kind: true,
            toStatus: true,
            toAssigneeUserId: true,
        },
    });
}

export function findITTicketNotificationCommentSource(
    tx: ITTicketNotificationReadContext,
    commentId: string,
): Promise<ITTicketNotificationCommentSource | null> {
    return tx.iTTicketComment.findUnique({
        where: { id: commentId },
        select: {
            id: true,
            ticketId: true,
            authorUserId: true,
            kind: true,
        },
    });
}

export function findITTicketNotificationResource(
    tx: ITTicketNotificationReadContext,
    ticketId: number,
): Promise<ITTicketNotificationResourceState | null> {
    return tx.iTTicket.findUnique({
        where: { id: ticketId },
        select: {
            id: true,
            requesterUserId: true,
            assignedToUserId: true,
            status: true,
        },
    });
}
