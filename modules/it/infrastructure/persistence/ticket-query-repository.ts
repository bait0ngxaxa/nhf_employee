import type { ITTicketStatus, ITTicketType, Prisma } from "@prisma/client";

export type ITTicketReadPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicket" | "iTTicketCategory"
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

export const IT_OPERATOR_TICKET_SELECT = {
    id: true,
    type: true,
    title: true,
    description: true,
    status: true,
    requesterUserId: true,
    assignedToUserId: true,
    categoryId: true,
    requesterDepartmentId: true,
    requesterDepartmentNameSnapshot: true,
    version: true,
    resolvedAt: true,
    createdAt: true,
    updatedAt: true,
    requester: {
        select: {
            id: true,
            name: true,
            email: true,
            employee: {
                select: { firstName: true, lastName: true, nickname: true },
            },
        },
    },
    assignedTo: {
        select: {
            id: true,
            name: true,
            email: true,
            employee: {
                select: { firstName: true, lastName: true, nickname: true },
            },
        },
    },
    category: {
        select: { id: true, key: true, name: true, isActive: true },
    },
} satisfies Prisma.ITTicketSelect;

export type ITOperatorTicketRecord = Prisma.ITTicketGetPayload<{
    select: typeof IT_OPERATOR_TICKET_SELECT;
}>;

export interface ITTicketCategoryReferenceRecord {
    readonly id: number;
    readonly key: string;
    readonly name: string;
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

/** Operator rows are queried only after the application checks read ALL. */
export async function findOperatorITTickets(
    tx: ITTicketReadPersistenceContext,
    where: Prisma.ITTicketWhereInput,
    take: number,
): Promise<ITOperatorTicketRecord[]> {
    return tx.iTTicket.findMany({
        where,
        select: IT_OPERATOR_TICKET_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
    });
}

/** Finds one operator detail row after the application checks read ALL. */
export async function findOperatorITTicketById(
    tx: ITTicketReadPersistenceContext,
    ticketId: number,
): Promise<ITOperatorTicketRecord | null> {
    return tx.iTTicket.findFirst({
        where: { id: ticketId },
        select: IT_OPERATOR_TICKET_SELECT,
    });
}

export async function findActiveITTicketCategories(
    tx: ITTicketReadPersistenceContext,
): Promise<ITTicketCategoryReferenceRecord[]> {
    return tx.iTTicketCategory.findMany({
        where: { isActive: true },
        select: { id: true, key: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
    });
}
