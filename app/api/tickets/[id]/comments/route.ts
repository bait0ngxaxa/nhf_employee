import { after, type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

/**
 * Build in-app notification data based on who commented.
 * Runs inside after() so it doesn't block the response.
 */
async function notifyCommentParticipants(
    ticket: { id: number; title: string; reportedById: number; assignedToId: number | null },
    commentAuthorId: number,
    isAdmin: boolean,
    isAssigned: boolean,
    isOwner: boolean,
): Promise<void> {
    const actionUrl = `/dashboard?tab=it-support&ticketId=${ticket.id}`;
    const referenceId = ticket.id.toString();

    if ((isAdmin || isAssigned) && ticket.reportedById !== commentAuthorId) {
        await prisma.notification.create({
            data: {
                userId: ticket.reportedById,
                type: "NEW_COMMENT",
                title: "คุณมีข้อความใหม่",
                message: `แอดมินหรือเจ้าหน้าที่ได้ตอบกลับปัญหา: ${ticket.title}`,
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
                title: "ผู้แจ้งมีการตอบกลับ",
                message: `มีข้อความใหม่ในปัญหา: ${ticket.title}`,
                actionUrl,
                referenceId,
            },
        });
    } else {
        const admins = await prisma.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true },
        });

        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map((admin) => ({
                    userId: admin.id,
                    type: "NEW_COMMENT" as const,
                    title: "มีผู้แจ้งโต้ตอบกลับ",
                    message: `มีข้อความใหม่ในปัญหา: ${ticket.title}`,
                    actionUrl,
                    referenceId,
                })),
            });
        }
    }
}

// POST - Add comment to ticket
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { content } = await request.json();

        // 1. Input Validation
        if (!content || content.trim() === "") {
            return NextResponse.json(
                { error: "Comment content is required" },
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

        const resolvedParams = await params;
        const ticketId = parseInt(resolvedParams.id);

        if (isNaN(ticketId)) {
            return NextResponse.json(
                { error: "Invalid ticket ID" },
                { status: 400 },
            );
        }

        const currentUserId = parseInt(session.user.id);
        if (isNaN(currentUserId)) {
            return NextResponse.json(
                { error: "Invalid user session" },
                { status: 400 },
            );
        }

        // Check if ticket exists
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
        });

        if (!ticket) {
            return NextResponse.json(
                { error: "Ticket not found" },
                { status: 404 },
            );
        }

        // Check permissions
        const isOwner = ticket.reportedById === currentUserId;
        const isAdmin = session.user?.role === "ADMIN";
        const isAssigned = ticket.assignedToId === currentUserId;

        if (!isOwner && !isAdmin && !isAssigned) {
            return NextResponse.json(
                { error: "Access denied" },
                { status: 403 },
            );
        }

        // Create comment
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

        // Dispatch in-app notifications after response (non-blocking)
        after(() => {
            notifyCommentParticipants(ticket, currentUserId, isAdmin, isAssigned, isOwner)
                .catch((err) => console.error("Comment notification failed:", err));
        });

        return NextResponse.json({ comment }, { status: 201 });
    } catch (error) {
        console.error("Error creating comment:", error);
        return NextResponse.json(
            { error: "Failed to create comment" },
            { status: 500 },
        );
    }
}
