import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user session" }, { status: 400 });
        }

        // Update all unread notifications for this user
        const result = await prisma.notification.updateMany({
            where: {
                userId: userId,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });

        return NextResponse.json({ success: true, updatedCount: result.count });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        return NextResponse.json({ error: "Failed to mark all notifications as read" }, { status: 500 });
    }
}
