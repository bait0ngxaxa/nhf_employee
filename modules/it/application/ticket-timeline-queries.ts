import { ITTicketEventKind } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getUserDisplayName } from "@/shared/identity/display";

import {
    IT_TICKET_DATABASE_INT_MAX,
    IT_TICKET_TIMELINE_DEFAULT_LIMIT,
    IT_TICKET_TIMELINE_MAX_LIMIT,
    type ITTicketTimelineEvent,
    type ITTicketTimelineItem,
    type ITTicketTimelinePage,
} from "../contracts";
import {
    ITCapabilityDeniedError,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
} from "./authorization";
import { ITTicketInputValidationError, ITTicketNotFoundError } from "./ticket-errors";
import { assertITActorCurrentWorkforce } from "./workforce";
import {
    findITTicketTimelineComments,
    findITTicketTimelineEvents,
    findOperatorITTicketConversationState,
    findRequesterITTicketConversationState,
    type ITTicketCommentRecord,
    type ITTicketEventTimelineRecord,
} from "../infrastructure/persistence/ticket-conversation-repository";

const ticketIdSchema = z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX);
const timelineLimitSchema = z.union([
    z.number().int().positive().max(IT_TICKET_TIMELINE_MAX_LIMIT),
    z.string().regex(/^[1-9]\d*$/).transform(Number)
        .pipe(z.number().int().positive().max(IT_TICKET_TIMELINE_MAX_LIMIT)),
]);

const timelineInputSchema = z.object({
    limit: timelineLimitSchema.default(IT_TICKET_TIMELINE_DEFAULT_LIMIT),
    cursor: z.string().min(1).max(256).optional(),
}).strict();

const timelineCursorSchema = z.discriminatedUnion("source", [
    z.object({
        ticketId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
        createdAt: z.string().datetime({ offset: true }),
        source: z.literal("EVENT"),
        id: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
    }).strict(),
    z.object({
        ticketId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
        createdAt: z.string().datetime({ offset: true }),
        source: z.literal("COMMENT"),
        id: z.string().min(1).max(30),
    }).strict(),
]);

type TimelineCursor = z.infer<typeof timelineCursorSchema>;
type TimelineRecord =
    | {
        readonly source: "EVENT";
        readonly id: number;
        readonly createdAt: Date;
        readonly item: ITTicketTimelineEvent;
    }
    | {
        readonly source: "COMMENT";
        readonly id: string;
        readonly createdAt: Date;
        readonly item: Extract<ITTicketTimelineItem, { readonly type: "COMMENT" }>;
    };

function decodeCursor(value: string, ticketId: number): TimelineCursor | null {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

    try {
        const json = Buffer.from(value, "base64url").toString("utf8");
        if (Buffer.from(json, "utf8").toString("base64url") !== value) return null;
        const parsedPayload: unknown = JSON.parse(json);
        const parsed = timelineCursorSchema.safeParse(parsedPayload);
        if (!parsed.success || parsed.data.ticketId !== ticketId) return null;
        const createdAt = new Date(parsed.data.createdAt);
        if (createdAt.toISOString() !== parsed.data.createdAt) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

function encodeCursor(ticketId: number, record: TimelineRecord): string {
    return Buffer.from(JSON.stringify({
        ticketId,
        createdAt: record.createdAt.toISOString(),
        source: record.source,
        id: record.id,
    }), "utf8").toString("base64url");
}

function compareTimelineRecords(left: TimelineRecord, right: TimelineRecord): number {
    const timeDifference = left.createdAt.getTime() - right.createdAt.getTime();
    if (timeDifference !== 0) return timeDifference;
    if (left.source !== right.source) return left.source === "EVENT" ? -1 : 1;
    if (left.source === "EVENT" && right.source === "EVENT") {
        return left.id - right.id;
    }
    if (left.source === "COMMENT" && right.source === "COMMENT") {
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }
    return 0;
}

function toEventItem(event: ITTicketEventTimelineRecord): ITTicketTimelineEvent {
    const actorDisplayName = getUserDisplayName(event.actor, "ไม่ระบุชื่อ");
    const createdAt = event.occurredAt.toISOString();

    switch (event.kind) {
        case ITTicketEventKind.CREATED:
            return { type: "CREATED", id: event.id, createdAt, actorDisplayName };
        case ITTicketEventKind.ASSIGNED:
        case ITTicketEventKind.UNASSIGNED:
            return {
                type: event.kind,
                id: event.id,
                createdAt,
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
                createdAt,
                actorDisplayName,
                fromStatus: event.fromStatus,
                toStatus: event.toStatus,
            };
        case ITTicketEventKind.CATEGORY_CHANGED:
            return {
                type: "CATEGORY_CHANGED",
                id: event.id,
                createdAt,
                actorDisplayName,
                fromCategoryName: event.fromCategory?.name ?? null,
                toCategoryName: event.toCategory?.name ?? null,
            };
    }
}

function toCommentItem(comment: ITTicketCommentRecord): Extract<
    ITTicketTimelineItem,
    { readonly type: "COMMENT" }
> {
    return {
        type: "COMMENT",
        id: comment.id,
        createdAt: comment.createdAt.toISOString(),
        authorDisplayName: getUserDisplayName(comment.author, "ไม่ระบุชื่อ"),
        authorSide: comment.kind,
        body: comment.body,
    };
}

function toTimelineRecord(event: ITTicketEventTimelineRecord): TimelineRecord {
    return {
        source: "EVENT",
        id: event.id,
        createdAt: event.occurredAt,
        item: toEventItem(event),
    };
}

function toCommentRecord(comment: ITTicketCommentRecord): TimelineRecord {
    return {
        source: "COMMENT",
        id: comment.id,
        createdAt: comment.createdAt,
        item: toCommentItem(comment),
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

function createOlderCommentWhere(
    ticketId: number,
    cursor: TimelineCursor | null,
): Prisma.ITTicketCommentWhereInput {
    if (cursor === null) return { ticketId };
    const sameTimeCursor = cursor.source === "COMMENT"
        ? { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }
        : null;
    return {
        ticketId,
        OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            ...(sameTimeCursor === null ? [] : [sameTimeCursor]),
        ],
    };
}

function createOlderEventWhere(
    ticketId: number,
    cursor: TimelineCursor | null,
): Prisma.ITTicketEventWhereInput {
    if (cursor === null) return { ticketId };
    const at = new Date(cursor.createdAt);
    const sameTimeCursor = cursor.source === "COMMENT"
        ? { occurredAt: at }
        : { occurredAt: at, id: { lt: cursor.id } };
    return {
        ticketId,
        OR: [
            { occurredAt: { lt: at } },
            sameTimeCursor,
        ],
    };
}

async function getITTicketTimeline(
    context: ITAuthorizationContext,
    rawTicketId: unknown,
    rawInput: unknown,
    side: "REQUESTER" | "OPERATOR",
): Promise<ITTicketTimelinePage> {
    const parsedId = ticketIdSchema.safeParse(rawTicketId);
    const parsedInput = timelineInputSchema.safeParse(rawInput);
    if (!parsedId.success || !parsedInput.success) {
        throw new ITTicketInputValidationError();
    }

    const ticketId = parsedId.data;
    const cursor = parsedInput.data.cursor === undefined
        ? null
        : decodeCursor(parsedInput.data.cursor, ticketId);
    if (parsedInput.data.cursor !== undefined && cursor === null) {
        throw new ITTicketInputValidationError();
    }

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
            ? await findRequesterITTicketConversationState(
                tx,
                ticketId,
                context.authorizationActor.userId,
            )
            : await findOperatorITTicketConversationState(tx, ticketId);
        if (ticket === null) throw new ITTicketNotFoundError();

        const take = parsedInput.data.limit + 1;
        const [events, comments] = await Promise.all([
            findITTicketTimelineEvents(
                tx,
                createOlderEventWhere(ticketId, cursor),
                take,
            ),
            findITTicketTimelineComments(
                tx,
                createOlderCommentWhere(ticketId, cursor),
                take,
            ),
        ]);
        const newestFirst = [
            ...events.map(toTimelineRecord),
            ...comments.map(toCommentRecord),
        ].sort((left, right) => compareTimelineRecords(right, left));
        const hasMore = newestFirst.length > parsedInput.data.limit;
        const pageNewestFirst = newestFirst.slice(0, parsedInput.data.limit);
        const oldestItem = pageNewestFirst.at(-1);

        return {
            items: pageNewestFirst.reverse().map((record) => record.item),
            olderCursor: hasMore && oldestItem !== undefined
                ? encodeCursor(ticketId, oldestItem)
                : null,
            hasMore,
        };
    });
}

/** Reads one chronological timeline page under the requester's OWN resource boundary. */
export function getITRequesterTicketTimeline(
    context: ITAuthorizationContext,
    ticketId: unknown,
    input: unknown = {},
): Promise<ITTicketTimelinePage> {
    return getITTicketTimeline(context, ticketId, input, "REQUESTER");
}

/** Reads one chronological timeline page only after current read ALL authority. */
export function getITOperatorTicketTimeline(
    context: ITAuthorizationContext,
    ticketId: unknown,
    input: unknown = {},
): Promise<ITTicketTimelinePage> {
    return getITTicketTimeline(context, ticketId, input, "OPERATOR");
}
