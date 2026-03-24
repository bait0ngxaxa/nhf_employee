import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { updateTicketSchema } from "@/lib/validations/ticket";
import { ticketService, type UpdateTicketData } from "@/lib/services/ticket";
import { buildUserContext } from "@/lib/context";
import { processOutbox } from "@/lib/services/outbox/processor";
import { after } from "next/server";

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
        const session = await getApiAuthSession();

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
        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return NextResponse.json(
                { error: "Invalid ticket ID" },
                { status: 400 },
            );
        }

        const body = await request.json();

        // 1. Input Validation with Zod (partial validation for updates)
        const validationResult = updateTicketSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.flatten();
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        // 2. Auth Check
        const session = await getApiAuthSession();

        if (!session) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
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

        // (Notifications are now triggered transactionally via outbox)
        after(async () => {
            processOutbox().catch((err) =>
                console.error("Outbox processor failed:", err),
            );
            
            // In-app Notification for status update
            const currentUserId = Number(user.id);
            if (result.ticket && result.ticket.reportedById !== currentUserId && updateData.status) {
                await prisma.notification.create({
                    data: {
                        userId: result.ticket.reportedById,
                        type: "TICKET_UPDATED",
                        title: "อัปเดตสถานะปัญหา",
                        message: `ปัญหา '${result.ticket.title}' เปลี่ยนสถานะเป็น: ${updateData.status}`,
                        actionUrl: `/dashboard?tab=it-support&ticketId=${ticketId}`,
                        referenceId: ticketId.toString()
                    }
                });
            }
        });

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
        const session = await getApiAuthSession();

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

