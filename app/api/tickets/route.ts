import { after, type NextRequest, NextResponse } from "next/server";

import { buildUserContext } from "@/lib/context";
import { logTicketEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { processOutbox } from "@/lib/services/outbox/processor";
import { ticketService, type TicketFilters } from "@/lib/services/ticket";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
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
        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        const parsedFilters = parseQueryParams(request.url);
        if (!parsedFilters.success) {
            return parsedFilters.response;
        }

        const user = buildUserContext(session);
        const result = await ticketService.getTickets(parsedFilters.data, user);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Error fetching tickets:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchTickets, 500);
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();
        const result = createTicketSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return jsonError(COMMON_API_MESSAGES.operationFailed, 400, {
                details: errors.fieldErrors,
            });
        }

        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        const user = buildUserContext(session);
        const ticket = await ticketService.createTicket(result.data, user.id);

        after(async () => {
            processOutbox().catch((err) =>
                console.error("Outbox processor failed:", err),
            );

            await logTicketEvent("TICKET_CREATE", ticket.id, user.id, user.email, {
                after: {
                    title: ticket.title,
                    category: ticket.category,
                    priority: ticket.priority,
                    status: ticket.status,
                },
            });

            const admins = await prisma.user.findMany({
                where: { role: "ADMIN" },
            });

            if (admins.length > 0) {
                await prisma.notification.createMany({
                    data: admins.map((admin) => ({
                        userId: admin.id,
                        type: "TICKET_CREATED",
                        title: "Notification",
                        message: COMMON_API_MESSAGES.operationCompleted,
                        actionUrl: `${APP_ROUTES.dashboard}?tab=it-support&ticketId=${ticket.id}`,
                        referenceId: ticket.id.toString(),
                    })),
                });
            }
        });

        return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
        console.error("Error creating ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToCreateTicket, 500);
    }
}
