import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user session" }, { status: 400 });
        }

        const cursor = req.nextUrl.searchParams.get("cursor");
        const filter = req.nextUrl.searchParams.get("filter"); // "all" | "unread"

        const whereClause = {
            userId,
            ...(filter === "unread" ? { isRead: false } : {}),
        };

        const [notifications, totalCount] = await Promise.all([
            prisma.notification.findMany({
                where: {
                    ...whereClause,
                    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
                },
                orderBy: { createdAt: "desc" },
                take: PAGE_SIZE + 1, // Fetch one extra to determine hasMore
            }),
            prisma.notification.count({ where: whereClause }),
        ]);

        const hasMore = notifications.length > PAGE_SIZE;
        const items = hasMore ? notifications.slice(0, PAGE_SIZE) : notifications;
        const nextCursor = hasMore
            ? items[items.length - 1].createdAt.toISOString()
            : null;

        return NextResponse.json({
            notifications: items,
            nextCursor,
            hasMore,
            totalCount,
        });
    } catch (error) {
        console.error("Error fetching all notifications:", error);
        return NextResponse.json(
            { error: "Failed to fetch notifications" },
            { status: 500 },
        );
    }
}
