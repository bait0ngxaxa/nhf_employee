import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = parseInt(auth.session.user.id, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserSession }, { status: 400 });
        }

        const cursor = req.nextUrl.searchParams.get("cursor");
        const filter = req.nextUrl.searchParams.get("filter");

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
                take: PAGE_SIZE + 1,
            }),
            prisma.notification.count({ where: whereClause }),
        ]);

        const hasMore = notifications.length > PAGE_SIZE;
        const items = hasMore ? notifications.slice(0, PAGE_SIZE) : notifications;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return NextResponse.json({
            notifications: items,
            nextCursor,
            hasMore,
            totalCount,
        });
    } catch (error) {
        console.error("Error fetching all notifications:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchNotifications },
            { status: 500 },
        );
    }
}
