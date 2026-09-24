import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import {
    ITCapabilityDeniedError,
    resolveITCapabilityInTransaction,
    type ITAuthorizationContext,
} from "./authorization";
import { ITTicketInputValidationError, ITTicketNotFoundError } from "./ticket-errors";
import { assertITActorCurrentWorkforce } from "./workforce";
import { toITRequesterTicket } from "./ticket-dto";
import {
    countRequesterITTickets,
    findRequesterITTicketById,
    findRequesterITTickets,
} from "../infrastructure/persistence/ticket-query-repository";
import {
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    IT_TICKET_LIST_MAX_LIMIT,
    type ITRequesterTicket,
    type ITRequesterTicketList,
} from "../contracts";

export {
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_LIST_DEFAULT_PAGE,
    IT_TICKET_LIST_MAX_LIMIT,
} from "../contracts";

export const listITRequesterTicketsInputSchema = z.object({
    page: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)
        .default(IT_TICKET_LIST_DEFAULT_PAGE),
    limit: z.coerce.number().int().positive().max(IT_TICKET_LIST_MAX_LIMIT)
        .default(IT_TICKET_LIST_DEFAULT_LIMIT),
}).strict();

const ticketIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

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
