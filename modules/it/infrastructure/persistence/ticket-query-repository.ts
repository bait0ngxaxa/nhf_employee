import type { ITTicketStatus, ITTicketType, Prisma } from "@prisma/client";

export type ITTicketReadPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicket"
>;

export interface ITRequesterTicketRecord {
    readonly id: number;
    readonly type: ITTicketType;
    readonly title: string;
    readonly description: string;
    readonly status: ITTicketStatus;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly resolvedAt: Date | null;
}

const REQUESTER_TICKET_SELECT = {
    id: true,
    type: true,
    title: true,
    description: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    resolvedAt: true,
} satisfies Prisma.ITTicketSelect;

export async function countRequesterITTickets(
    tx: ITTicketReadPersistenceContext,
    requesterUserId: number,
): Promise<number> {
    return tx.iTTicket.count({ where: { requesterUserId } });
}

export async function findRequesterITTickets(
    tx: ITTicketReadPersistenceContext,
    requesterUserId: number,
    pagination: { readonly skip: number; readonly take: number },
): Promise<ITRequesterTicketRecord[]> {
    return tx.iTTicket.findMany({
        where: { requesterUserId },
        select: REQUESTER_TICKET_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
    });
}

export async function findRequesterITTicketById(
    tx: ITTicketReadPersistenceContext,
    ticketId: number,
    requesterUserId: number,
): Promise<ITRequesterTicketRecord | null> {
    return tx.iTTicket.findFirst({
        where: { id: ticketId, requesterUserId },
        select: REQUESTER_TICKET_SELECT,
    });
}
