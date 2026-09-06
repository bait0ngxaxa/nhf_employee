import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { listHistoryForUser } from "@/modules/notification";

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

        const result = await listHistoryForUser({ userId, cursor, filter });
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching all notifications:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchNotifications },
            { status: 500 },
        );
    }
}
