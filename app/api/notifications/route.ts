import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function GET(_req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = parseInt(session.user.id, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserSession }, { status: 400 });
        }

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

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchNotifications },
            { status: 500 },
        );
    }
}
