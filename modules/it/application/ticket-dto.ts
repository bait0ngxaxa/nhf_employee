import type { ITRequesterTicket } from "../contracts";
import type { ITTicketRecord } from "./types";

export function toITRequesterTicket(
    ticket: Pick<ITTicketRecord,
        "id" | "type" | "title" | "description" | "status"
        | "createdAt" | "updatedAt" | "resolvedAt"
    >,
): ITRequesterTicket {
    return Object.freeze({
        id: ticket.id,
        type: ticket.type,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    });
}
