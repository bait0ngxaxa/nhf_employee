import { ITTicketEventKind } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getUserDisplayName } from "@/shared/identity/display";

import {
    IT_TICKET_ACTIVITY_DEFAULT_LIMIT,
    IT_TICKET_ACTIVITY_MAX_LIMIT,
    IT_TICKET_CONVERSATION_DEFAULT_LIMIT,
    IT_TICKET_CONVERSATION_MAX_LIMIT,
    IT_TICKET_DATABASE_INT_MAX,
    type ITTicketActivityItem,
    type ITTicketActivityPage,
    type ITTicketConversationItem,
    type ITTicketConversationPage,
} from "../contracts";
import {
    ITCapabilityDeniedError,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
} from "./authorization";
import { ITTicketInputValidationError, ITTicketNotFoundError } from "./ticket-errors";
import { assertITActorCurrentWorkforce } from "./workforce";
import {
    findITTicketActivityEvents,
    findITTicketConversationComments,
    findOperatorITTicketReadState,
    findRequesterITTicketReadState,
    type ITTicketActivityEventRecord,
    type ITTicketCommentRecord,
} from "../infrastructure/persistence/ticket-conversation-repository";

const ticketIdSchema = z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX);
const historyLimitSchema = z.union([
    z.number().int().positive().max(IT_TICKET_ACTIVITY_MAX_LIMIT),
    z.string().regex(/^[1-9]\d*$/).transform(Number)
        .pipe(z.number().int().positive().max(IT_TICKET_ACTIVITY_MAX_LIMIT)),
]);
const historyInputSchema = z.object({
    limit: historyLimitSchema.optional(),
    cursor: z.string().min(1).max(256).optional(),
}).strict();

const conversationCursorSchema = z.object({
    ticketId: ticketIdSchema,
    createdAt: z.string().datetime({ offset: true }),
    source: z.literal("COMMENT"),
    id: z.string().min(1).max(30),
}).strict();
const activityCursorSchema = z.object({
    ticketId: ticketIdSchema,
    occurredAt: z.string().datetime({ offset: true }),
    source: z.literal("EVENT"),
    id: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
}).strict();

type ConversationCursor = z.infer<typeof conversationCursorSchema>;
type ActivityCursor = z.infer<typeof activityCursorSchema>;
interface HistoryInput {
    readonly limit: number;
    readonly cursor?: string;
}

function parseTicketId(rawTicketId: unknown): number {
    const parsed = ticketIdSchema.safeParse(rawTicketId);
    if (!parsed.success) throw new ITTicketInputValidationError();
    return parsed.data;
}

function parseHistoryInput(
    rawInput: unknown,
    defaultLimit: number,
    maxLimit: number,
): HistoryInput {
    const parsed = historyInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new ITTicketInputValidationError();
    const limit = parsed.data.limit ?? defaultLimit;
    if (limit > maxLimit) throw new ITTicketInputValidationError();
    return {
        limit,
        ...(parsed.data.cursor === undefined ? {} : { cursor: parsed.data.cursor }),
    };
}

function decodeCursorPayload(value: string): unknown | null {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
    try {
        const json = Buffer.from(value, "base64url").toString("utf8");
        if (Buffer.from(json, "utf8").toString("base64url") !== value) return null;
        return JSON.parse(json) as unknown;
    } catch {
        return null;
    }
}

function decodeConversationCursor(value: string, ticketId: number): ConversationCursor | null {
    const parsed = conversationCursorSchema.safeParse(decodeCursorPayload(value));
    if (!parsed.success || parsed.data.ticketId !== ticketId) return null;
    const createdAt = new Date(parsed.data.createdAt);
    return createdAt.toISOString() === parsed.data.createdAt ? parsed.data : null;
}

function decodeActivityCursor(value: string, ticketId: number): ActivityCursor | null {
    const parsed = activityCursorSchema.safeParse(decodeCursorPayload(value));
    if (!parsed.success || parsed.data.ticketId !== ticketId) return null;
    const occurredAt = new Date(parsed.data.occurredAt);
    return occurredAt.toISOString() === parsed.data.occurredAt ? parsed.data : null;
}

function encodeCursor(cursor: ConversationCursor | ActivityCursor): string {
    return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function toActivityItem(event: ITTicketActivityEventRecord): ITTicketActivityItem {
    const actorDisplayName = getUserDisplayName(event.actor, "ไม่ระบุชื่อ");
    const occurredAt = event.occurredAt.toISOString();

    switch (event.kind) {
        case ITTicketEventKind.CREATED:
            return { type: "CREATED", id: event.id, occurredAt, actorDisplayName };
        case ITTicketEventKind.ASSIGNED:
        case ITTicketEventKind.UNASSIGNED:
            return {
                type: event.kind,
                id: event.id,
                occurredAt,
                actorDisplayName,
                fromAssigneeDisplayName: event.fromAssignee === null
                    ? null
                    : getUserDisplayName(event.fromAssignee, "ไม่ระบุชื่อ"),
                toAssigneeDisplayName: event.toAssignee === null
                    ? null
                    : getUserDisplayName(event.toAssignee, "ไม่ระบุชื่อ"),
            };
        case ITTicketEventKind.STATUS_CHANGED:
            return {
                type: "STATUS_CHANGED",
                id: event.id,
                occurredAt,
                actorDisplayName,
                fromStatus: event.fromStatus,
                toStatus: event.toStatus,
            };
        case ITTicketEventKind.CATEGORY_CHANGED:
            return {
                type: "CATEGORY_CHANGED",
                id: event.id,
                occurredAt,
                actorDisplayName,
                fromCategoryName: event.fromCategory?.name ?? null,
                toCategoryName: event.toCategory?.name ?? null,
            };
    }
}

function toConversationItem(comment: ITTicketCommentRecord): ITTicketConversationItem {
    const attachments = comment.attachments.map((attachment) => {
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
    });
    return {
        id: comment.id,
        createdAt: comment.createdAt.toISOString(),
        authorDisplayName: getUserDisplayName(comment.author, "ไม่ระบุชื่อ"),
        authorSide: comment.kind,
        body: comment.body,
        attachments,
    };
}

function assertRequesterReadScope(scopes: readonly string[]): void {
    // Even ALL authority is constrained to requesterUserId by the query below.
    if (!scopes.includes("OWN") && !scopes.includes("ALL")) {
        throw new ITCapabilityDeniedError("it.ticket.read", "NO_APPLICABLE_GRANT");
    }
}

function assertOperatorReadScope(scopes: readonly string[]): void {
    if (!scopes.includes("ALL")) {
        throw new ITCapabilityDeniedError("it.ticket.read", "NO_APPLICABLE_GRANT");
    }
}

async function withAuthorizedTicketRead<T>(
    context: ITAuthorizationContext,
    ticketId: number,
    side: "REQUESTER" | "OPERATOR",
    read: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        if (side === "OPERATOR") assertOperatorReadScope(authorization.scopes);
        else assertRequesterReadScope(authorization.scopes);

        const ticket = side === "REQUESTER"
            ? await findRequesterITTicketReadState(
                tx,
                ticketId,
                context.authorizationActor.userId,
            )
            : await findOperatorITTicketReadState(tx, ticketId);
        if (ticket === null) throw new ITTicketNotFoundError();
        return read(tx);
    });
}

function createOlderConversationWhere(
    ticketId: number,
    cursor: ConversationCursor | null,
): Prisma.ITTicketCommentWhereInput {
    if (cursor === null) return { ticketId };
    const createdAt = new Date(cursor.createdAt);
    return {
        ticketId,
        OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: cursor.id } },
        ],
    };
}

function createOlderActivityWhere(
    ticketId: number,
    cursor: ActivityCursor | null,
): Prisma.ITTicketEventWhereInput {
    if (cursor === null) return { ticketId };
    const occurredAt = new Date(cursor.occurredAt);
    return {
        ticketId,
        OR: [
            { occurredAt: { lt: occurredAt } },
            { occurredAt, id: { lt: cursor.id } },
        ],
    };
}

async function getITTicketConversation(
    context: ITAuthorizationContext,
    rawTicketId: unknown,
    rawInput: unknown,
    side: "REQUESTER" | "OPERATOR",
): Promise<ITTicketConversationPage> {
    const ticketId = parseTicketId(rawTicketId);
    const input = parseHistoryInput(
        rawInput,
        IT_TICKET_CONVERSATION_DEFAULT_LIMIT,
        IT_TICKET_CONVERSATION_MAX_LIMIT,
    );
    const cursor = input.cursor === undefined
        ? null
        : decodeConversationCursor(input.cursor, ticketId);
    if (input.cursor !== undefined && cursor === null) {
        throw new ITTicketInputValidationError();
    }

    return withAuthorizedTicketRead(context, ticketId, side, async (tx) => {
        const records = await findITTicketConversationComments(
            tx,
            createOlderConversationWhere(ticketId, cursor),
            input.limit + 1,
        );
        const hasMore = records.length > input.limit;
        const pageNewestFirst = records.slice(0, input.limit);
        const oldestComment = pageNewestFirst.at(-1);
        return {
            items: [...pageNewestFirst].reverse().map(toConversationItem),
            olderCursor: hasMore && oldestComment !== undefined
                ? encodeCursor({
                    ticketId,
                    createdAt: oldestComment.createdAt.toISOString(),
                    source: "COMMENT",
                    id: oldestComment.id,
                })
                : null,
            hasMore,
        };
    });
}

async function getITTicketActivity(
    context: ITAuthorizationContext,
    rawTicketId: unknown,
    rawInput: unknown,
    side: "REQUESTER" | "OPERATOR",
): Promise<ITTicketActivityPage> {
    const ticketId = parseTicketId(rawTicketId);
    const input = parseHistoryInput(
        rawInput,
        IT_TICKET_ACTIVITY_DEFAULT_LIMIT,
        IT_TICKET_ACTIVITY_MAX_LIMIT,
    );
    const cursor = input.cursor === undefined
        ? null
        : decodeActivityCursor(input.cursor, ticketId);
    if (input.cursor !== undefined && cursor === null) {
        throw new ITTicketInputValidationError();
    }

    return withAuthorizedTicketRead(context, ticketId, side, async (tx) => {
        const records = await findITTicketActivityEvents(
            tx,
            createOlderActivityWhere(ticketId, cursor),
            input.limit + 1,
        );
        const hasMore = records.length > input.limit;
        const pageNewestFirst = records.slice(0, input.limit);
        const oldestEvent = pageNewestFirst.at(-1);
        return {
            items: [...pageNewestFirst].reverse().map(toActivityItem),
            olderCursor: hasMore && oldestEvent !== undefined
                ? encodeCursor({
                    ticketId,
                    occurredAt: oldestEvent.occurredAt.toISOString(),
                    source: "EVENT",
                    id: oldestEvent.id,
                })
                : null,
            hasMore,
        };
    });
}

/** Reads comment-only conversation under the requester's own Ticket boundary. */
export function getITRequesterTicketConversation(
    context: ITAuthorizationContext,
    ticketId: unknown,
    input: unknown = {},
): Promise<ITTicketConversationPage> {
    return getITTicketConversation(context, ticketId, input, "REQUESTER");
}

/** Reads comment-only conversation only after current read ALL authority. */
export function getITOperatorTicketConversation(
    context: ITAuthorizationContext,
    ticketId: unknown,
    input: unknown = {},
): Promise<ITTicketConversationPage> {
    return getITTicketConversation(context, ticketId, input, "OPERATOR");
}

/** Reads event-only Ticket activity under the requester's own Ticket boundary. */
export function getITRequesterTicketActivity(
    context: ITAuthorizationContext,
    ticketId: unknown,
    input: unknown = {},
): Promise<ITTicketActivityPage> {
    return getITTicketActivity(context, ticketId, input, "REQUESTER");
}

/** Reads event-only Ticket activity only after current read ALL authority. */
export function getITOperatorTicketActivity(
    context: ITAuthorizationContext,
    ticketId: unknown,
    input: unknown = {},
): Promise<ITTicketActivityPage> {
    return getITTicketActivity(context, ticketId, input, "OPERATOR");
}
