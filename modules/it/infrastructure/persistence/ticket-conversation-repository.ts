import type { ITTicketStatus, Prisma } from "@prisma/client";

export type ITTicketConversationPersistenceContext = Pick<
    Prisma.TransactionClient,
    | "iTTicket"
    | "iTTicketComment"
    | "iTTicketCommentIdempotency"
    | "iTTicketEvent"
    | "iTTicketAttachment"
>;

export const IT_TICKET_COMMENT_SELECT = {
    id: true,
    ticketId: true,
    authorUserId: true,
    kind: true,
    body: true,
    createdAt: true,
    author: {
        select: {
            name: true,
            employee: {
                select: { firstName: true, lastName: true, nickname: true },
            },
        },
    },
    attachments: {
        select: {
            id: true,
            originalName: true,
            contentType: true,
            sizeBytes: true,
            width: true,
            height: true,
            position: true,
        },
        orderBy: { position: "asc" },
    },
} satisfies Prisma.ITTicketCommentSelect;

export type ITTicketCommentRecord = Prisma.ITTicketCommentGetPayload<{
    select: typeof IT_TICKET_COMMENT_SELECT;
}>;

export const IT_TICKET_EVENT_TIMELINE_SELECT = {
    id: true,
    kind: true,
    fromStatus: true,
    toStatus: true,
    occurredAt: true,
    actor: {
        select: {
            name: true,
            employee: {
                select: { firstName: true, lastName: true, nickname: true },
            },
        },
    },
    fromAssignee: {
        select: {
            name: true,
            employee: {
                select: { firstName: true, lastName: true, nickname: true },
            },
        },
    },
    toAssignee: {
        select: {
            name: true,
            employee: {
                select: { firstName: true, lastName: true, nickname: true },
            },
        },
    },
    fromCategory: { select: { name: true } },
    toCategory: { select: { name: true } },
} satisfies Prisma.ITTicketEventSelect;

export type ITTicketEventTimelineRecord = Prisma.ITTicketEventGetPayload<{
    select: typeof IT_TICKET_EVENT_TIMELINE_SELECT;
}>;

export interface ITTicketConversationState {
    readonly id: number;
    readonly requesterUserId: number;
    readonly status: ITTicketStatus;
    readonly firstRespondedAt: Date | null;
}

export async function findRequesterITTicketConversationState(
    tx: ITTicketConversationPersistenceContext,
    ticketId: number,
    requesterUserId: number,
): Promise<ITTicketConversationState | null> {
    return tx.iTTicket.findFirst({
        where: { id: ticketId, requesterUserId },
        select: { id: true, requesterUserId: true, status: true, firstRespondedAt: true },
    });
}

export async function findOperatorITTicketConversationState(
    tx: ITTicketConversationPersistenceContext,
    ticketId: number,
): Promise<ITTicketConversationState | null> {
    return tx.iTTicket.findUnique({
        where: { id: ticketId },
        select: { id: true, requesterUserId: true, status: true, firstRespondedAt: true },
    });
}

export async function findITTicketCommentReplay(
    tx: ITTicketConversationPersistenceContext,
    authorUserId: number,
    idempotencyKey: string,
): Promise<{
    readonly requestHash: string;
    readonly comment: ITTicketCommentRecord;
} | null> {
    return tx.iTTicketCommentIdempotency.findUnique({
        where: { authorUserId_idempotencyKey: { authorUserId, idempotencyKey } },
        select: {
            requestHash: true,
            comment: { select: IT_TICKET_COMMENT_SELECT },
        },
    });
}

export async function createITTicketComment(
    tx: ITTicketConversationPersistenceContext,
    data: Prisma.ITTicketCommentUncheckedCreateInput,
): Promise<ITTicketCommentRecord> {
    return tx.iTTicketComment.create({
        data,
        select: IT_TICKET_COMMENT_SELECT,
    });
}

export async function createITTicketAttachmentRows(
    tx: ITTicketConversationPersistenceContext,
    data: Prisma.ITTicketAttachmentCreateManyInput[],
): Promise<void> {
    if (data.length === 0) return;
    await tx.iTTicketAttachment.createMany({ data });
}

export async function findITTicketCommentById(
    tx: ITTicketConversationPersistenceContext,
    id: string,
): Promise<ITTicketCommentRecord> {
    return tx.iTTicketComment.findUniqueOrThrow({
        where: { id },
        select: IT_TICKET_COMMENT_SELECT,
    });
}

export async function createITTicketCommentIdempotency(
    tx: ITTicketConversationPersistenceContext,
    data: Prisma.ITTicketCommentIdempotencyUncheckedCreateInput,
): Promise<void> {
    await tx.iTTicketCommentIdempotency.create({ data, select: { id: true } });
}

export async function claimITTicketFirstResponse(
    tx: ITTicketConversationPersistenceContext,
    ticketId: number,
    respondedAt: Date,
): Promise<void> {
    await tx.iTTicket.updateMany({
        where: { id: ticketId, firstRespondedAt: null },
        data: { firstRespondedAt: respondedAt },
    });
}

export async function findITTicketTimelineComments(
    tx: ITTicketConversationPersistenceContext,
    where: Prisma.ITTicketCommentWhereInput,
    take: number,
): Promise<ITTicketCommentRecord[]> {
    return tx.iTTicketComment.findMany({
        where,
        select: IT_TICKET_COMMENT_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
    });
}

export async function findITTicketTimelineEvents(
    tx: ITTicketConversationPersistenceContext,
    where: Prisma.ITTicketEventWhereInput,
    take: number,
): Promise<ITTicketEventTimelineRecord[]> {
    return tx.iTTicketEvent.findMany({
        where,
        select: IT_TICKET_EVENT_TIMELINE_SELECT,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take,
    });
}
