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
    claimITTicketFirstResponse,
    createITTicketComment,
    createITTicketCommentIdempotency,
    findITTicketCommentReplay,
    findOperatorITTicketConversationState,
    findRequesterITTicketConversationState,
    type ITTicketCommentRecord,
    type ITTicketConversationPersistenceContext,
} from "../infrastructure/persistence/ticket-conversation-repository";
import type { ITTicketCommentSubmission } from "../contracts";

interface PostCommentOptions {
    readonly idempotencyKey: string;
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
    const requestHash = createITTicketCommentRequestHash({
        ticketId,
        authorSide: side,
        body,
    });

    try {
        return await runSerializableTransaction(async (tx) => {
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

            return toSubmission(comment, false);
        });
    } catch (error) {
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
