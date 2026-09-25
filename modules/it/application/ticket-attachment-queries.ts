import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

import { ITCapabilityDeniedError, resolveITCapabilityInTransaction } from "./authorization";
import { ITTicketNotFoundError } from "./ticket-errors";
import { assertITActorCurrentWorkforce } from "./workforce";
import type { ITAuthorizationContext } from "./authorization";
import { findITTicketAttachmentForRead } from "../infrastructure/persistence/ticket-attachment-repository";

const attachmentIdSchema = z.string().regex(/^[a-f0-9]{32}$/);

export interface ITTicketAttachmentDownloadRecord {
    readonly id: string;
    readonly ticketId: number;
    readonly storageKey: string;
    readonly contentType: string;
}

export async function getITTicketAttachmentForDownload(
    context: ITAuthorizationContext,
    rawAttachmentId: unknown,
): Promise<ITTicketAttachmentDownloadRecord> {
    const parsedId = attachmentIdSchema.safeParse(rawAttachmentId);
    if (!parsedId.success) throw new ITTicketNotFoundError();

    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        const canReadOwn = authorization.scopes.includes("OWN");
        const canReadAll = authorization.scopes.includes("ALL");
        if (!canReadOwn && !canReadAll) {
            throw new ITCapabilityDeniedError(
                "it.ticket.read",
                authorization.decision.reason ?? "NO_APPLICABLE_GRANT",
            );
        }

        const attachment = await findITTicketAttachmentForRead(
            tx,
            parsedId.data,
            canReadAll ? undefined : context.authorizationActor.userId,
        );
        if (
            attachment === null
            || attachment.ticketId !== attachment.comment.ticketId
            || attachment.commentId !== attachment.comment.id
            || (!canReadAll && attachment.ticket.requesterUserId !== context.authorizationActor.userId)
        ) {
            throw new ITTicketNotFoundError();
        }

        return {
            id: attachment.id,
            ticketId: attachment.ticketId,
            storageKey: attachment.storageKey,
            contentType: attachment.contentType,
        };
    });
}
