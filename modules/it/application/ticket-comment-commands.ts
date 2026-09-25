import { ITTicketCommentKind, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction, hasPrismaErrorCode } from "@/lib/db/transaction";
import { getUserDisplayName } from "@/shared/identity/display";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";

import {
    ITCapabilityDeniedError,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
} from "./authorization";
import { assertITActorCurrentWorkforce } from "./workforce";
import { findITOperatorAudience } from "./operator-audience";
import type { ITTicketNotificationPayloadV1 } from "../domain/ticket-notification";
import { enqueueITTicketNotificationIntents } from "../infrastructure/notifications/outbox";
import {
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketMutationConflictError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
} from "./ticket-errors";
import { createITTicketCommentInputSchema } from "./ticket-schemas";
import { createITTicketCommentRequestHash, isITTicketCommentableStatus } from "../domain/ticket-conversation";
import {
    ITTicketAttachmentValidationError,
    prepareITTicketAttachments,
    type ITTicketAttachmentSource,
} from "../infrastructure/attachments/validation";
import {
    deleteITTicketAttachmentFiles,
    writeITTicketAttachments,
} from "../infrastructure/attachments/storage";
import {
    claimITTicketFirstResponse,
    createITTicketComment,
    createITTicketAttachmentRows,
    createITTicketCommentIdempotency,
    findITTicketCommentById,
    findITTicketCommentReplay,
    findOperatorITTicketConversationState,
    findRequesterITTicketConversationState,
    type ITTicketCommentRecord,
    type ITTicketConversationState,
    type ITTicketConversationPersistenceContext,
} from "../infrastructure/persistence/ticket-conversation-repository";
import type { ITTicketCommentSubmission } from "../contracts";

interface PostCommentOptions {
    readonly idempotencyKey: string;
    readonly attachments?: readonly ITTicketAttachmentSource[];
}

type ITTicketCommentSide = typeof ITTicketCommentKind[keyof typeof ITTicketCommentKind];

class ITTicketCommentIdempotencyRaceError extends Error {}

function toSubmission(
    comment: ITTicketCommentRecord,
    replayed: boolean,
): ITTicketCommentSubmission {
    return {
        comment: {
            type: "COMMENT",
            id: comment.id,
            createdAt: comment.createdAt.toISOString(),
            authorDisplayName: getUserDisplayName(comment.author, "ไม่ระบุชื่อ"),
            authorSide: comment.kind,
            body: comment.body,
            attachments: comment.attachments.map((attachment) => {
                if (attachment.contentType !== "image/webp") {
                    throw new Error("Invalid IT Ticket attachment content type");
                }
                return {
                    id: attachment.id,
                    originalName: attachment.originalName,
                    contentType: "image/webp" as const,
                    sizeBytes: attachment.sizeBytes,
                    width: attachment.width,
                    height: attachment.height,
                    position: attachment.position,
                };
            }),
        },
        replayed,
    };
}

async function assertCommentAuthority(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    side: ITTicketCommentSide,
): Promise<void> {
    if (side === ITTicketCommentKind.OPERATOR) {
        const read = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        if (!read.scopes.includes("ALL")) {
            throw new ITCapabilityDeniedError(
                "it.ticket.read",
                read.decision.reason ?? "NO_APPLICABLE_GRANT",
            );
        }
    }

    const comment = await resolveITCapabilityInTransaction(
        context,
        "it.ticket.comment",
        tx,
    );
    const allowed = side === ITTicketCommentKind.OPERATOR
        ? comment.scopes.includes("ALL")
        : comment.scopes.includes("OWN") || comment.scopes.includes("ALL");
    if (!allowed) {
        throw new ITCapabilityDeniedError(
            "it.ticket.comment",
            comment.decision.reason ?? "NO_APPLICABLE_GRANT",
        );
    }
}

async function findConversationTicket(
    tx: ITTicketConversationPersistenceContext,
    ticketId: number,
    requesterUserId: number,
    side: ITTicketCommentSide,
) {
    const ticket = side === ITTicketCommentKind.REQUESTER
        ? await findRequesterITTicketConversationState(tx, ticketId, requesterUserId)
        : await findOperatorITTicketConversationState(tx, ticketId);
    if (ticket === null) throw new ITTicketNotFoundError();
    return ticket;
}

async function readReplay(
    tx: Prisma.TransactionClient,
    context: ITAuthorizationContext,
    ticketId: number,
    side: ITTicketCommentSide,
    idempotencyKey: string,
    requestHash: string,
): Promise<ITTicketCommentSubmission | null> {
    await assertITActorCurrentWorkforce(tx, context);
    await assertCommentAuthority(tx, context, side);
    await findConversationTicket(
        tx,
        ticketId,
        context.authorizationActor.userId,
        side,
    );

    const existing = await findITTicketCommentReplay(
        tx,
        context.authorizationActor.userId,
        idempotencyKey,
    );
    if (existing === null) return null;
    if (existing.requestHash !== requestHash) {
        throw new ITTicketIdempotencyConflictError();
    }
    return toSubmission(existing.comment, true);
}

async function enqueueCommentNotificationIntents(
    tx: Prisma.TransactionClient,
    ticket: ITTicketConversationState,
    commentId: string,
    authorUserId: number,
    side: ITTicketCommentSide,
): Promise<void> {
    const recipients: Array<{
        readonly userId: number;
        readonly audience: "REQUESTER" | "ASSIGNEE" | "OPERATOR_QUEUE";
    }> = side === ITTicketCommentKind.OPERATOR
        ? ticket.requesterUserId === authorUserId
            ? []
            : [{ userId: ticket.requesterUserId, audience: "REQUESTER" }]
        : ticket.assignedToUserId !== null
            ? ticket.assignedToUserId === authorUserId
                ? []
                : [{ userId: ticket.assignedToUserId, audience: "ASSIGNEE" }]
            : (await findITOperatorAudience(tx))
                .filter((operator) => operator.userId !== authorUserId)
                .map((operator) => ({
                    userId: operator.userId,
                    audience: "OPERATOR_QUEUE" as const,
                }));

    const event = side === ITTicketCommentKind.OPERATOR
        ? "OPERATOR_COMMENTED"
        : "REQUESTER_COMMENTED";
    const payloads: ITTicketNotificationPayloadV1[] = recipients.map(
        (recipient) => ({
            version: 1,
            event,
            ticketId: ticket.id,
            recipientUserId: recipient.userId,
            audience: recipient.audience,
            source: { kind: "COMMENT", id: commentId },
        }),
    );
    await enqueueITTicketNotificationIntents(tx, payloads);
}

async function postITTicketComment(
    context: ITAuthorizationContext,
    input: unknown,
    options: PostCommentOptions,
    side: ITTicketCommentSide,
): Promise<ITTicketCommentSubmission> {
    const parsedInput = createITTicketCommentInputSchema.safeParse(input);
    if (!parsedInput.success) throw new ITTicketInputValidationError();
    const parsedKey = idempotencyKeySchema.safeParse(options.idempotencyKey);
    if (!parsedKey.success) throw new ITTicketInputValidationError();

    const { ticketId, body } = parsedInput.data;
    const idempotencyKey = parsedKey.data;
    const authorUserId = context.authorizationActor.userId;
    const preparedAttachments = await prepareITTicketAttachments(options.attachments ?? []);
    const requestHash = createITTicketCommentRequestHash({
        ticketId,
        authorSide: side,
        body,
        attachments: preparedAttachments.map((attachment) => ({
            originalName: attachment.originalName,
            contentSha256: attachment.contentSha256,
        })),
    });

    if (preparedAttachments.length > 0) {
        const replay = await prisma.$transaction(async (tx) => {
            await assertITActorCurrentWorkforce(tx, context);
            await assertCommentAuthority(tx, context, side);
            const ticket = await findConversationTicket(
                tx,
                ticketId,
                authorUserId,
                side,
            );
            const existing = await findITTicketCommentReplay(
                tx,
                authorUserId,
                idempotencyKey,
            );
            if (existing !== null) {
                if (existing.requestHash !== requestHash) {
                    throw new ITTicketIdempotencyConflictError();
                }
                return toSubmission(existing.comment, true);
            }
            if (!isITTicketCommentableStatus(ticket.status)) {
                throw new ITTicketNotCommentableError();
            }
            return null;
        });
        if (replay !== null) return replay;
    }

    const storedAttachments = preparedAttachments.length === 0
        ? []
        : await writeITTicketAttachments(ticketId, preparedAttachments);

    try {
        const result = await runSerializableTransaction(async (tx) => {
            await assertITActorCurrentWorkforce(tx, context);
            await assertCommentAuthority(tx, context, side);
            const ticket = await findConversationTicket(
                tx,
                ticketId,
                authorUserId,
                side,
            );

            const existing = await findITTicketCommentReplay(
                tx,
                authorUserId,
                idempotencyKey,
            );
            if (existing !== null) {
                if (existing.requestHash !== requestHash) {
                    throw new ITTicketIdempotencyConflictError();
                }
                return toSubmission(existing.comment, true);
            }

            if (!isITTicketCommentableStatus(ticket.status)) {
                throw new ITTicketNotCommentableError();
            }

            const comment = await createITTicketComment(tx, {
                ticketId,
                authorUserId,
                kind: side,
                body,
            });

            if (storedAttachments.length > 0) {
                await createITTicketAttachmentRows(tx, storedAttachments.map((attachment) => ({
                    id: attachment.id,
                    ticketId,
                    commentId: comment.id,
                    uploaderUserId: authorUserId,
                    position: attachment.position,
                    storageKey: attachment.storageKey,
                    originalName: attachment.originalName,
                    contentType: attachment.contentType,
                    contentSha256: attachment.contentSha256,
                    sizeBytes: attachment.sizeBytes,
                    width: attachment.width,
                    height: attachment.height,
                })));
            }
            const persistedComment = storedAttachments.length === 0
                ? comment
                : await findITTicketCommentById(tx, comment.id);

            if (side === ITTicketCommentKind.OPERATOR) {
                await claimITTicketFirstResponse(tx, ticketId, comment.createdAt);
            }

            try {
                await createITTicketCommentIdempotency(tx, {
                    authorUserId,
                    idempotencyKey,
                    requestHash,
                    commentId: comment.id,
                });
            } catch (error) {
                if (hasPrismaErrorCode(error, "P2002")) {
                    throw new ITTicketCommentIdempotencyRaceError();
                }
                throw error;
            }

            await enqueueCommentNotificationIntents(
                tx,
                ticket,
                comment.id,
                authorUserId,
                side,
            );

            return toSubmission(persistedComment, false);
        });
        if (result.replayed && storedAttachments.length > 0) {
            await deleteITTicketAttachmentFiles(
                storedAttachments.map((attachment) => attachment.storageKey),
            );
        }
        return result;
    } catch (error) {
        if (storedAttachments.length > 0) {
            await deleteITTicketAttachmentFiles(
                storedAttachments.map((attachment) => attachment.storageKey),
            );
        }
        const idempotencyRace = error instanceof ITTicketCommentIdempotencyRaceError;
        const serializationRace = hasPrismaErrorCode(error, "P2034");
        if (!idempotencyRace && !serializationRace) throw error;

        const replay = await prisma.$transaction((tx) => readReplay(
            tx,
            context,
            ticketId,
            side,
            idempotencyKey,
            requestHash,
        ));
        if (replay !== null) return replay;
        if (idempotencyRace) throw new ITTicketIdempotencyConflictError();
        throw new ITTicketMutationConflictError("CONCURRENT_WRITE");
    }
}

/** Requester entry point always enforces requester ownership, even with comment ALL. */
export function postITRequesterTicketComment(
    context: ITAuthorizationContext,
    input: unknown,
    options: PostCommentOptions,
): Promise<ITTicketCommentSubmission> {
    return postITTicketComment(context, input, options, ITTicketCommentKind.REQUESTER);
}

/** Operator entry point independently requires read ALL and comment ALL. */
export function postITOperatorTicketComment(
    context: ITAuthorizationContext,
    input: unknown,
    options: PostCommentOptions,
): Promise<ITTicketCommentSubmission> {
    return postITTicketComment(context, input, options, ITTicketCommentKind.OPERATOR);
}

export { ITTicketAttachmentValidationError };
