import { after, type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTicketSchema, ticketFiltersSchema } from "@/lib/validations/ticket";
import { logTicketEvent } from "@/lib/audit";
import { ticketService, type TicketFilters } from "@/lib/services/ticket";
import { buildUserContext } from "@/lib/context";
import { processOutbox } from "@/lib/services/outbox/processor";

/**
 * Parse and validate query parameters into TicketFilters
 */
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
            response: NextResponse.json(
                {
                    error: "ข้อมูลตัวกรองไม่ถูกต้อง",
                    details: validation.error.flatten().fieldErrors,
                },
                { status: 400 },
            ),
        };
    }

    return { success: true, data: validation.data };
}

// GET - Retrieve tickets (filtered by role)
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
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
        return NextResponse.json(
            { error: "Failed to fetch tickets" },
            { status: 500 },
        );
    }
}

// POST - Create new ticket
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = await request.json();

        // 1. Input Validation with Zod
        const result = createTicketSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                { error: "เธเนเธญเธกเธนเธฅเนเธกเนเธ–เธนเธเธ•เนเธญเธ", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        // 2. Auth Check
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const user = buildUserContext(session);
        const ticket = await ticketService.createTicket(result.data, user.id);

        after(async () => {
            // Processing outbox in background
            processOutbox().catch((err) =>
                console.error("Outbox processor failed:", err),
            );

            // Log audit event
            await logTicketEvent(
                "TICKET_CREATE",
                ticket.id,
                user.id,
                user.email,
                {
                    after: {
                        title: ticket.title,
                        category: ticket.category,
                        priority: ticket.priority,
                        status: ticket.status,
                    },
                },
            );
        });

        return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
        console.error("Error creating ticket:", error);
        return NextResponse.json(
            { error: "Failed to create ticket" },
            { status: 500 },
        );
    }
}

