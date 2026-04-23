import { after } from "next/server";
import { type NextRequest, NextResponse } from "next/server";

import { buildUserContext } from "@/lib/context";
import { prisma } from "@/lib/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { ticketService, type UpdateTicketData } from "@/lib/services/ticket";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { updateTicketSchema } from "@/lib/validations/ticket";

async function parseTicketId(
    params: Promise<{ id: string }>,
): Promise<{ ticketId: number | null; error?: NextResponse }> {
    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id, 10);

    if (Number.isNaN(ticketId)) {
        return {
            ticketId: null,
            error: jsonError(COMMON_API_MESSAGES.invalidTicketId, 400),
        };
    }

    return { ticketId };
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const user = buildUserContext(session);
        const result = await ticketService.getTicketById(ticketId, user);

        if (result.error) {
            return jsonError(result.error, result.status || 500);
        }

        await ticketService.recordTicketView(ticketId, user.id);
        return NextResponse.json({ ticket: result.ticket }, { status: 200 });
    } catch (error) {
        console.error("Error fetching ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchTicket, 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const body = await request.json();
        const validationResult = updateTicketSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.flatten();
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: errors.fieldErrors,
            });
        }

        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        const user = buildUserContext(session);
        const updateData: UpdateTicketData = {
            title: validationResult.data.title,
            description: validationResult.data.description,
            category: validationResult.data.category,
            priority: validationResult.data.priority,
            status: validationResult.data.status,
            assignedToId: validationResult.data.assignedToId,
        };

        const result = await ticketService.updateTicket(ticketId, updateData, user);
        if (result.error) {
            return jsonError(result.error, result.status || 500);
        }

        after(async () => {
            processOutbox().catch((err) =>
                console.error("Outbox processor failed:", err),
            );

            const ticket = result.ticket;
            if (!ticket) {
                return;
            }

            const currentUserId = Number(user.id);
            const hasStatusChanged =
                typeof result.oldStatus === "string" &&
                ticket.status !== result.oldStatus;

            if (
                hasStatusChanged &&
                ticket.reportedById !== currentUserId
            ) {
                await prisma.notification.create({
                    data: {
                        userId: ticket.reportedById,
                        type: "TICKET_UPDATED",
                        title: "สถานะคำขอ IT Support อัปเดต",
                        message: `คำขอ "${ticket.title}" เปลี่ยนสถานะจาก ${result.oldStatus} เป็น ${ticket.status}`,
                        actionUrl: `${APP_ROUTES.dashboard}?tab=it-support&ticketId=${ticketId}`,
                        referenceId: ticketId.toString(),
                    },
                });
            }
        });

        return NextResponse.json({ ticket: result.ticket }, { status: 200 });
    } catch (error) {
        console.error("Error updating ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToUpdateTicket, 500);
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        const { ticketId, error } = await parseTicketId(params);
        if (error) return error;
        if (!ticketId) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const user = buildUserContext(session);
        const result = await ticketService.deleteTicket(ticketId, user);

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        return NextResponse.json({ message: COMMON_API_MESSAGES.ticketDeletedSuccessfully }, { status: 200 });
    } catch (error) {
        console.error("Error deleting ticket:", error);
        return jsonError(COMMON_API_MESSAGES.failedToDeleteTicket, 500);
    }
}
