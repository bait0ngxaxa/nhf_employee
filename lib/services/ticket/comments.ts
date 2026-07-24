import type { Prisma, Ticket } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { isAdminRole } from "@/lib/ssot/permissions";
import type { CreateTicketCommentInput } from "@/lib/validations/ticket";
import { createTicketAudit } from "./audit";
import {
    assertMatchingTicketIdempotency,
    createTicketCommentRequestHash,
} from "./idempotency";
import {
    enqueueTicketCommentOutbox,
    getTicketCommentRecipientIds,
} from "./outbox";
import type { UserContext } from "./types";

const COMMENT_INCLUDE = {
    author: {
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                },
            },
        },
    },
} satisfies Prisma.TicketCommentInclude;

type TicketCommentWithAuthor = Prisma.TicketCommentGetPayload<{
    include: typeof COMMENT_INCLUDE;
}>;

type CreateCommentOptions = {
    idempotencyKey: string;
};

type CreateCommentCommand = {
    ticketId: number;
    data: CreateTicketCommentInput;
    actor: UserContext;
    idempotencyKey: string;
    requestHash: string;
};

type CreatedCommentContext = {
    command: CreateCommentCommand;
    ticket: Ticket;
    comment: TicketCommentWithAuthor;
    isOwner: boolean;
    isAdmin: boolean;
};

export type CreateTicketCommentResult =
    | {
          outcome: "created";
          comment: TicketCommentWithAuthor;
          replayed: boolean;
      }
    | { outcome: "not_found"; replayed: false }
    | { outcome: "forbidden"; replayed: false };

type CommentReplayClient = Pick<
    Prisma.TransactionClient,
    "ticketComment" | "ticketMutationIdempotency"
>;

async function findReplayedComment(
    client: CommentReplayClient,
    actorId: number,
    idempotencyKey: string,
    requestHash: string,
): Promise<TicketCommentWithAuthor | null> {
    const record = await client.ticketMutationIdempotency.findUnique({
        where: {
            userId_idempotencyKey: { userId: actorId, idempotencyKey },
        },
    });
    if (!record) return null;

    assertMatchingTicketIdempotency(
        record,
        "TICKET_COMMENT",
        requestHash,
    );
    const comment = await client.ticketComment.findUnique({
        where: { id: record.resourceId },
        include: COMMENT_INCLUDE,
    });
    if (!comment) {
        throw new Error("Idempotent ticket comment was not found");
    }
    return comment;
}

function getCommentAuthorName(comment: TicketCommentWithAuthor): string {
    const employee = comment.author.employee;
    return employee?.firstName && employee.lastName
        ? `${employee.firstName} ${employee.lastName}`
        : comment.author.name;
}

async function persistCommentSideEffects(
    tx: Prisma.TransactionClient,
    context: CreatedCommentContext,
): Promise<void> {
    const { actor, idempotencyKey, requestHash, ticketId } = context.command;
    const { comment, isAdmin, isOwner, ticket } = context;
    await createTicketAudit(tx, "TICKET_COMMENT", ticketId, actor, {
        after: {
            commentId: comment.id,
            content: comment.content,
            authorId: actor.id,
        },
    });
    const recipientIds = await getTicketCommentRecipientIds(tx, {
        reportedById: ticket.reportedById,
        assignedToId: ticket.assignedToId,
        actorId: actor.id,
        isAdmin,
        isOwner,
    });
    await enqueueTicketCommentOutbox(tx, {
        ticketId,
        commentId: comment.id,
        recipientIds,
        authorId: actor.id,
        authorName: getCommentAuthorName(comment),
        ticketTitle: ticket.title,
        authorIsOwner: isOwner,
    });
    await tx.ticketMutationIdempotency.create({
        data: {
            userId: actor.id,
            idempotencyKey,
            operation: "TICKET_COMMENT",
            requestHash,
            resourceId: comment.id,
        },
    });
}

async function createCommentInTransaction(
    tx: Prisma.TransactionClient,
    command: CreateCommentCommand,
): Promise<CreateTicketCommentResult> {
    const { actor, data, idempotencyKey, requestHash, ticketId } = command;
    const replayed = await findReplayedComment(
        tx,
        actor.id,
        idempotencyKey,
        requestHash,
    );
    if (replayed) {
        return { outcome: "created", comment: replayed, replayed: true };
    }

    const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, deletedAt: null },
    });
    if (!ticket) return { outcome: "not_found", replayed: false };

    const isOwner = ticket.reportedById === actor.id;
    const isAdmin = isAdminRole(actor.role);
    if (!isOwner && !isAdmin) {
        return { outcome: "forbidden", replayed: false };
    }

    const comment = await tx.ticketComment.create({
        data: { content: data.content, ticketId, authorId: actor.id },
        include: COMMENT_INCLUDE,
    });
    await persistCommentSideEffects(tx, {
        command,
        ticket,
        comment,
        isAdmin,
        isOwner,
    });
    return { outcome: "created", comment, replayed: false };
}

export async function createTicketComment(
    ticketId: number,
    data: CreateTicketCommentInput,
    actor: UserContext,
    options: CreateCommentOptions,
): Promise<CreateTicketCommentResult> {
    const requestHash = createTicketCommentRequestHash(ticketId, data.content);
    const command = {
        ticketId,
        data,
        actor,
        idempotencyKey: options.idempotencyKey,
        requestHash,
    };
    try {
        return await runSerializableTransaction((tx) =>
            createCommentInTransaction(tx, command),
        );
    } catch (error) {
        if (!hasPrismaErrorCode(error, "P2002")) throw error;

        const comment = await findReplayedComment(
            prisma,
            actor.id,
            options.idempotencyKey,
            requestHash,
        );
        if (!comment) throw error;
        return { outcome: "created", comment, replayed: true };
    }
}
