import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { listLatestForUser } from "@/modules/notification";

export async function GET(_req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = parseInt(auth.session.user.id, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserSession }, { status: 400 });
        }

        const { notifications, unreadCount } = await listLatestForUser(userId);

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchNotifications },
            { status: 500 },
        );
    }
}
