import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export type ITTicketAttachmentPersistenceContext = Pick<
    Prisma.TransactionClient,
    "iTTicketAttachment"
>;

export const IT_TICKET_ATTACHMENT_READ_SELECT = {
    id: true,
    ticketId: true,
    commentId: true,
    storageKey: true,
    contentType: true,
    ticket: { select: { requesterUserId: true } },
    comment: { select: { id: true, ticketId: true } },
} satisfies Prisma.ITTicketAttachmentSelect;

export type ITTicketAttachmentReadRecord = Prisma.ITTicketAttachmentGetPayload<{
    select: typeof IT_TICKET_ATTACHMENT_READ_SELECT;
}>;

export async function findITTicketAttachmentForRead(
    tx: ITTicketAttachmentPersistenceContext,
    id: string,
    requesterUserId?: number,
): Promise<ITTicketAttachmentReadRecord | null> {
    return tx.iTTicketAttachment.findFirst({
        where: requesterUserId === undefined
            ? { id }
            : { id, ticket: { is: { requesterUserId } } },
        select: IT_TICKET_ATTACHMENT_READ_SELECT,
    });
}

export async function findCommittedITTicketAttachmentStorageKeys(): Promise<
    readonly string[]
> {
    const attachments = await prisma.iTTicketAttachment.findMany({
        select: { storageKey: true },
    });
    return attachments.map((attachment) => attachment.storageKey);
}
