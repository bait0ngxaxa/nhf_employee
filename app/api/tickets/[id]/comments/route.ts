import { after, type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { APP_ROUTES } from "@/lib/ssot/routes";

async function notifyCommentParticipants(
    ticket: { id: number; title: string; reportedById: number; assignedToId: number | null },
    commentAuthorId: number,
    isAdmin: boolean,
    isAssigned: boolean,
    isOwner: boolean,
): Promise<void> {
    const actionUrl = `${APP_ROUTES.dashboard}?tab=it-support&ticketId=${ticket.id}`;
    const referenceId = ticket.id.toString();

    if ((isAdmin || isAssigned) && ticket.reportedById !== commentAuthorId) {
        await prisma.notification.create({
            data: {
                userId: ticket.reportedById,
                type: "NEW_COMMENT",
                title: "New comment",
                message: `A staff member replied on ticket: ${ticket.title}`,
                actionUrl,
                referenceId,
            },
        });
        return;
    }

    if (!isOwner) return;

    if (ticket.assignedToId) {
        await prisma.notification.create({
            data: {
                userId: ticket.assignedToId,
                type: "NEW_COMMENT",
                title: "Reporter replied",
                message: `New comment on ticket: ${ticket.title}`,
                actionUrl,
                referenceId,
            },
        });
        return;
    }

    const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
    });

    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.id,
                type: "NEW_COMMENT" as const,
                title: "Reporter replied",
                message: `New comment on ticket: ${ticket.title}`,
                actionUrl,
                referenceId,
            })),
        });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const { content } = await request.json();

        if (!content || content.trim() === "") {
            return jsonError(COMMON_API_MESSAGES.commentContentRequired, 400);
        }

        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        const resolvedParams = await params;
        const ticketId = parseInt(resolvedParams.id, 10);
        if (Number.isNaN(ticketId)) {
            return jsonError(COMMON_API_MESSAGES.invalidTicketId, 400);
        }

        const currentUserId = parseInt(session.user.id, 10);
        if (Number.isNaN(currentUserId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserSession, 400);
        }

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) {
            return jsonError(COMMON_API_MESSAGES.ticketNotFound, 404);
        }

        const isOwner = ticket.reportedById === currentUserId;
        const isAdmin = isAdminRole(session.user?.role);
        const isAssigned = ticket.assignedToId === currentUserId;

        if (!isOwner && !isAdmin && !isAssigned) {
            return jsonError(COMMON_API_MESSAGES.accessDenied, 403);
        }

        const comment = await prisma.ticketComment.create({
            data: {
                content: content.trim(),
                ticketId,
                authorId: currentUserId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        employee: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
            },
        });

        after(() => {
            notifyCommentParticipants(ticket, currentUserId, isAdmin, isAssigned, isOwner).catch((err) =>
                console.error("Comment notification failed:", err),
            );
        });

        return NextResponse.json({ comment }, { status: 201 });
    } catch (error) {
        console.error("Error creating comment:", error);
        return jsonError(COMMON_API_MESSAGES.failedToCreateComment, 500);
    }
}
