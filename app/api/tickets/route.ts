import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTicketSchema } from "@/lib/validations/ticket";
import { logTicketEvent } from "@/lib/audit";
import { ticketService, type TicketFilters } from "@/lib/services/ticket";
import { buildUserContext } from "@/lib/context";

/**
 * Parse query parameters into TicketFilters
 */
function parseQueryParams(url: string): TicketFilters {
    const { searchParams } = new URL(url);
    return {
        status: searchParams.get("status") || undefined,
        category: searchParams.get("category") || undefined,
        priority: searchParams.get("priority") || undefined,
        page: parseInt(searchParams.get("page") || "1"),
        limit: parseInt(searchParams.get("limit") || "10"),
    };
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

        const filters = parseQueryParams(request.url);
        const user = buildUserContext(session);
        const result = await ticketService.getTickets(filters, user);

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
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = await request.json();

        // Validate input with Zod
        const result = createTicketSchema.safeParse(body);
        if (!result.success) {
            const errors = result.error.flatten();
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const ticket = await ticketService.createTicket(result.data, user.id);

        // Send notifications (non-blocking)
        ticketService.sendTicketCreatedNotifications(ticket);

        // Log audit event
        await logTicketEvent("TICKET_CREATE", ticket.id, user.id, user.email, {
            after: {
                title: ticket.title,
                category: ticket.category,
                priority: ticket.priority,
                status: ticket.status,
            },
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
