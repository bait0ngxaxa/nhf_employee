import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { markAllReadForUser } from "@/modules/notification";

export async function POST(_req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = parseInt(auth.session.user.id, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserSession }, { status: 400 });
        }

        const updatedCount = await markAllReadForUser(userId);

        return NextResponse.json({ success: true, updatedCount });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToMarkAllNotificationsAsRead },
            { status: 500 },
        );
    }
}
