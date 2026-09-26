import { APP_ROUTES } from "@/lib/ssot/routes";
import { buildLiffUrl } from "@/lib/line/liff-links";

import { isValidITTicketId } from "../contracts";

export function buildITLiffUrl(): string {
    return buildLiffUrl(APP_ROUTES.line.it);
}

export function buildITTicketLiffUrl(ticketId: number): string {
    if (!isValidITTicketId(ticketId)) {
        throw new Error("Invalid IT Ticket ID");
    }

    return buildLiffUrl(APP_ROUTES.line.itTicket(ticketId));
}
