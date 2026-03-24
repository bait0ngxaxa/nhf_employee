import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user session" }, { status: 400 });
        }
        const resolvedParams = await params;
        const notificationId = resolvedParams.id;

        // Verify ownership and update
        const notification = await prisma.notification.update({
            where: {
                id: notificationId,
                userId: userId, // Ensure the notification belongs to the user
            },
            data: {
                isRead: true,
            },
        });

        return NextResponse.json({ success: true, notification });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return NextResponse.json({ error: "Failed to mark notification as read" }, { status: 500 });
    }
}
