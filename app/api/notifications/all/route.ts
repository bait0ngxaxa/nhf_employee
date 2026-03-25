import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = parseInt(session.user.id, 10);
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
