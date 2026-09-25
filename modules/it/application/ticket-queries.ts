import type { Prisma } from "@prisma/client";
import { ITTicketStatus, ITTicketType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { findCurrentEmployeeDisplayProjections, getEmployeeDisplayName } from "@/modules/employee";
import { findActiveUsersWithConfiguredCapabilityScope } from "@/modules/authorization";
import {
    ITCapabilityDeniedError,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
} from "./authorization";
import { ITTicketInputValidationError, ITTicketNotFoundError } from "./ticket-errors";
import { assertITActorCurrentWorkforce } from "./workforce";
import { toITRequesterTicket } from "./ticket-dto";
import { toITOperatorTicket } from "./ticket-dto";
import {
    countRequesterITTickets,
    findActiveITTicketCategories,
    findOperatorITTicketById,
    findOperatorITTickets,
    findRequesterITTicketById,
    findRequesterITTickets,
} from "../infrastructure/persistence/ticket-query-repository";
import {
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    IT_TICKET_LIST_MAX_LIMIT,
    IT_OPERATOR_QUEUE_DEFAULT_LIMIT,
    IT_OPERATOR_QUEUE_MAX_LIMIT,
    IT_TICKET_DATABASE_INT_MAX,
    type ITAssignableOperator,
    type ITOperatorReferenceData,
    type ITOperatorTicket,
    type ITOperatorTicketList,
    type ITRequesterTicket,
    type ITRequesterTicketList,
} from "../contracts";

export {
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    IT_TICKET_LIST_MAX_LIMIT,
} from "../contracts";

export { IT_OPERATOR_QUEUE_DEFAULT_LIMIT, IT_OPERATOR_QUEUE_MAX_LIMIT } from "../contracts";

export const listITRequesterTicketsInputSchema = z.object({
    page: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)
        .default(IT_TICKET_LIST_DEFAULT_PAGE),
    limit: z.coerce.number().int().positive().max(IT_TICKET_LIST_MAX_LIMIT)
        .default(IT_TICKET_LIST_DEFAULT_LIMIT),
}).strict();

const ticketIdSchema = z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX);

const positiveSafeInteger = z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX);
const positiveQueryInteger = z.union([
    positiveSafeInteger,
    z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(positiveSafeInteger),
]);

const operatorQueueInputSchema = z.object({
    status: z.nativeEnum(ITTicketStatus).optional(),
    type: z.nativeEnum(ITTicketType).optional(),
    categoryId: z.union([
        z.literal("uncategorized"),
        positiveQueryInteger,
    ]).optional(),
    assignmentState: z.enum(["ASSIGNED", "UNASSIGNED"]).optional(),
    assigneeUserId: positiveQueryInteger.optional(),
    limit: positiveQueryInteger
        .pipe(z.number().max(IT_OPERATOR_QUEUE_MAX_LIMIT))
        .default(IT_OPERATOR_QUEUE_DEFAULT_LIMIT),
    cursor: z.string().min(1).max(256).optional(),
}).strict().superRefine((input, context) => {
    if (input.assignmentState === "UNASSIGNED" && input.assigneeUserId !== undefined) {
        context.addIssue({
            code: "custom",
            path: ["assigneeUserId"],
            message: "An unassigned queue cannot target a specific assignee",
        });
    }
});

const ticketQueueCursorSchema = z.object({
    createdAt: z.string().datetime({ offset: true }),
    id: positiveSafeInteger,
}).strict();

interface ParsedITOperatorQueueCursor {
    readonly createdAt: Date;
    readonly id: number;
}

function decodeITOperatorQueueCursor(value: string): ParsedITOperatorQueueCursor | null {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

    try {
        const json = Buffer.from(value, "base64url").toString("utf8");
        if (Buffer.from(json, "utf8").toString("base64url") !== value) return null;
        const parsedPayload: unknown = JSON.parse(json);
        const parsed = ticketQueueCursorSchema.safeParse(parsedPayload);
        if (!parsed.success) return null;

        const createdAt = new Date(parsed.data.createdAt);
        if (createdAt.toISOString() !== parsed.data.createdAt) return null;
        return { createdAt, id: parsed.data.id };
    } catch {
        return null;
    }
}

function encodeITOperatorQueueCursor(ticket: Pick<ITOperatorTicket, "id" | "createdAt">): string {
    return Buffer.from(JSON.stringify({
        createdAt: ticket.createdAt,
        id: ticket.id,
    }), "utf8").toString("base64url");
}

function assertOperatorReadScope(scopes: readonly string[]): void {
    if (!scopes.includes("ALL")) {
        throw new ITCapabilityDeniedError("it.ticket.read", "NO_APPLICABLE_GRANT");
    }
}

function createOperatorTicketWhere(
    input: z.output<typeof operatorQueueInputSchema>,
    cursor: ParsedITOperatorQueueCursor | null,
): Prisma.ITTicketWhereInput {
    const where: Prisma.ITTicketWhereInput = {};
    if (input.status !== undefined) where.status = input.status;
    if (input.type !== undefined) where.type = input.type;
    if (input.categoryId !== undefined) {
        where.categoryId = input.categoryId === "uncategorized" ? null : input.categoryId;
    }
    if (input.assigneeUserId !== undefined) {
        where.assignedToUserId = input.assigneeUserId;
    } else if (input.assignmentState === "UNASSIGNED") {
        where.assignedToUserId = null;
    } else if (input.assignmentState === "ASSIGNED") {
        where.assignedToUserId = { not: null };
    }
    if (cursor !== null) {
        where.OR = [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ];
    }
    return where;
}

function assertRequesterReadScope(scopes: readonly string[], capability: string): void {
    // ALL includes requester access, but this surface always queries only OWN rows.
    if (!scopes.includes("OWN") && !scopes.includes("ALL")) {
        throw new ITCapabilityDeniedError(capability, "NO_APPLICABLE_GRANT");
    }
}

/** Lists only the current requester's Tickets, with ownership applied in SQL. */
export async function listITRequesterTickets(
    context: ITAuthorizationContext,
    input: unknown,
): Promise<ITRequesterTicketList> {
    const parsed = listITRequesterTicketsInputSchema.safeParse(input);
    if (!parsed.success) throw new ITTicketInputValidationError();

    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        assertRequesterReadScope(authorization.scopes, "it.ticket.read");

        const { page, limit } = parsed.data;
        const requesterUserId = context.authorizationActor.userId;
        const total = await countRequesterITTickets(tx, requesterUserId);
        const totalPages = Math.ceil(total / limit);
        const records = page > totalPages
            ? []
            : await findRequesterITTickets(tx, requesterUserId, {
                skip: (page - 1) * limit,
                take: limit,
            });

        return {
            tickets: records.map(toITRequesterTicket),
            pagination: { page, limit, total, totalPages },
        };
    });
}

/** Finds a Ticket only when its id and immutable requester both match. */
export async function getITRequesterTicket(
    context: ITAuthorizationContext,
    ticketId: unknown,
): Promise<ITRequesterTicket> {
    const parsedId = ticketIdSchema.safeParse(ticketId);
    if (!parsedId.success) throw new ITTicketInputValidationError();

    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        assertRequesterReadScope(authorization.scopes, "it.ticket.read");

        const ticket = await findRequesterITTicketById(
            tx,
            parsedId.data,
            context.authorizationActor.userId,
        );
        if (ticket === null) throw new ITTicketNotFoundError();
        return toITRequesterTicket(ticket);
    });
}

/** Lists a bounded organization-wide queue using stable descending keyset pagination. */
export async function listITOperatorTickets(
    context: ITAuthorizationContext,
    input: unknown,
): Promise<ITOperatorTicketList> {
    const parsed = operatorQueueInputSchema.safeParse(input);
    if (!parsed.success) throw new ITTicketInputValidationError();
    const cursor = parsed.data.cursor === undefined
        ? null
        : decodeITOperatorQueueCursor(parsed.data.cursor);
    if (parsed.data.cursor !== undefined && cursor === null) {
        throw new ITTicketInputValidationError();
    }

    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        assertOperatorReadScope(authorization.scopes);

        const records = await findOperatorITTickets(
            tx,
            createOperatorTicketWhere(parsed.data, cursor),
            parsed.data.limit + 1,
        );
        const hasMore = records.length > parsed.data.limit;
        const pageRecords = records.slice(0, parsed.data.limit);
        const tickets = pageRecords.map(toITOperatorTicket);
        const lastTicket = tickets.at(-1);

        return {
            tickets,
            nextCursor: hasMore && lastTicket
                ? encodeITOperatorQueueCursor(lastTicket)
                : null,
            limit: parsed.data.limit,
        };
    });
}

/** Reads any one Ticket only after current workforce and read ALL are established. */
export async function getITOperatorTicket(
    context: ITAuthorizationContext,
    ticketId: unknown,
): Promise<ITOperatorTicket> {
    const parsedId = ticketIdSchema.safeParse(ticketId);
    if (!parsedId.success) throw new ITTicketInputValidationError();

    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        assertOperatorReadScope(authorization.scopes);

        const ticket = await findOperatorITTicketById(tx, parsedId.data);
        if (ticket === null) throw new ITTicketNotFoundError();
        return toITOperatorTicket(ticket);
    });
}

/** Provides only active category choices and explicitly eligible operator labels. */
export async function getITOperatorReferenceData(
    context: ITAuthorizationContext,
): Promise<ITOperatorReferenceData> {
    return prisma.$transaction(async (tx) => {
        await assertITActorCurrentWorkforce(tx, context);
        const authorization = await resolveITCapabilityInTransaction(
            context,
            "it.ticket.read",
            tx,
        );
        assertOperatorReadScope(authorization.scopes);

        const [categories, readUsers, commentUsers, manageUsers] = await Promise.all([
            findActiveITTicketCategories(tx),
            findActiveUsersWithConfiguredCapabilityScope({
                capability: "it.ticket.read",
                scope: "ALL",
            }, tx),
            findActiveUsersWithConfiguredCapabilityScope({
                capability: "it.ticket.comment",
                scope: "ALL",
            }, tx),
            findActiveUsersWithConfiguredCapabilityScope({
                capability: "it.ticket.manage",
                scope: "ALL",
            }, tx),
        ]);

        const commentUserIds = new Set(commentUsers);
        const manageUserIds = new Set(manageUsers);
        const eligibleUserIds = readUsers.filter((userId) =>
            commentUserIds.has(userId) && manageUserIds.has(userId),
        );
        const employees = await findCurrentEmployeeDisplayProjections(eligibleUserIds, tx);
        const assignableOperators: ITAssignableOperator[] = employees
            .map((employee) => ({
                userId: employee.userId,
                employeeId: employee.employeeId,
                displayName: getEmployeeDisplayName(employee),
            }))
            .sort((left, right) => left.displayName.localeCompare(right.displayName, "th")
                || left.userId - right.userId);

        return {
            categories,
            assignableOperators,
        };
    });
}
