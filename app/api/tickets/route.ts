import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { createTicketCommandActor } from "@/lib/server/ticket-command-actor";
import { processOutbox } from "@/lib/services/outbox/processor";
import { ticketService, type TicketFilters } from "@/lib/services/ticket";
import { jsonError, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { createTicketSchema, ticketFiltersSchema } from "@/lib/validations/ticket";

function parseQueryParams(url: string):
    | { success: true; data: TicketFilters }
    | { success: false; response: NextResponse } {
    const { searchParams } = new URL(url);
    const validation = ticketFiltersSchema.safeParse({
        status: searchParams.get("status"),
        category: searchParams.get("category"),
        priority: searchParams.get("priority"),
        search: searchParams.get("search"),
        page: searchParams.get("page") ?? "1",
        limit: searchParams.get("limit") ?? "10",
    });

    if (!validation.success) {
        return {
            success: false,
            response: jsonError(COMMON_API_MESSAGES.operationFailed, 400, {
                details: validation.error.flatten().fieldErrors,
            }),
        };
    }

    return { success: true, data: validation.data };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const parsedFilters = parseQueryParams(request.url);
        if (!parsedFilters.success) {
            return parsedFilters.response;
        }

        const result = await ticketService.getTickets(parsedFilters.data, auth.user);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Error fetching tickets:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchTickets, 500);
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.itSupport)) {
            return notFound();
        }

        const body = await request.json();
        const result = createTicketSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return jsonError(COMMON_API_MESSAGES.operationFailed, 400, {
                details: errors.fieldErrors,
            });
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const actor = createTicketCommandActor(auth.user, request.headers);
        const ticket = await ticketService.createTicket(result.data, actor);

        after(async () => {
            processOutbox().catch((err) =>
                console.error("Outbox processor failed:", err),
            );

        });

        return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
        console.error("Error creating ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToCreateTicket, 500);
    }
}
