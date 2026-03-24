import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user session" }, { status: 400 });
        }

        // Fetch notifications and unread count in parallel
        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: 10,
            }),
            prisma.notification.count({
                where: { userId, isRead: false },
            }),
        ]);

        return NextResponse.json({
            notifications,
            unreadCount,
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}

