import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateTicketSchema } from "@/lib/validations/ticket";
import { ticketService, type UpdateTicketData } from "@/lib/services/ticket";
import { buildUserContext } from "@/lib/context";

/**
 * Parse and validate ticket ID from params
 */
async function parseTicketId(
    params: Promise<{ id: string }>,
): Promise<{ ticketId: number | null; error?: NextResponse }> {
    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);

    if (isNaN(ticketId)) {
        return {
            ticketId: null,
            error: NextResponse.json(
                { error: "Invalid ticket ID" },
                { status: 400 },
            ),
        };
    }

    return { ticketId };
}

// GET - Get single ticket with comments
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return NextResponse.json(
                { error: "Invalid ticket ID" },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const result = await ticketService.getTicketById(ticketId, user);

        if (result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status || 500 },
            );
        }

        // Record view
        await ticketService.recordTicketView(ticketId, user.id);

        return NextResponse.json({ ticket: result.ticket }, { status: 200 });
    } catch (error) {
        console.error("Error fetching ticket:", error);
        return NextResponse.json(
            { error: "Failed to fetch ticket" },
            { status: 500 },
        );
    }
}

// PATCH - Update ticket (status, assignment, etc.)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return NextResponse.json(
                { error: "Invalid ticket ID" },
                { status: 400 },
            );
        }

        const body = await request.json();

        // Validate input with Zod (partial validation for updates)
        const validationResult = updateTicketSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.flatten();
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const updateData: UpdateTicketData = {
            title: validationResult.data.title,
            description: validationResult.data.description,
            category: validationResult.data.category,
            priority: validationResult.data.priority,
            status: validationResult.data.status,
            assignedToId: validationResult.data.assignedToId,
            resolution: validationResult.data.resolution,
        };

        const result = await ticketService.updateTicket(
            ticketId,
            updateData,
            user,
        );

        if (result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status || 500 },
            );
        }

        // Send notifications if status changed (non-blocking)
        if (
            updateData.status &&
            result.oldStatus &&
            result.ticket &&
            updateData.status !== result.oldStatus
        ) {
            ticketService.sendTicketUpdatedNotifications(
                result.ticket,
                result.oldStatus,
            );
        }

        return NextResponse.json({ ticket: result.ticket }, { status: 200 });
    } catch (error) {
        console.error("Error updating ticket:", error);
        return NextResponse.json(
            { error: "Failed to update ticket" },
            { status: 500 },
        );
    }
}

// DELETE - Delete ticket (admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return NextResponse.json(
                { error: "Invalid ticket ID" },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const result = await ticketService.deleteTicket(ticketId, user);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status || 500 },
            );
        }

        return NextResponse.json(
            { message: "Ticket deleted successfully" },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error deleting ticket:", error);
        return NextResponse.json(
            { error: "Failed to delete ticket" },
            { status: 500 },
        );
    }
}
