import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    assertNotificationCapabilityForMigration,
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationContext,
    listLatestForUser,
    NotificationCapabilityDeniedError,
} from "@/modules/notification";

export async function GET(_req: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = parseInt(auth.session.user.id, 10);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserSession }, { status: 400 });
        }

        const authorization = await assertNotificationCapabilityForMigration(
            buildNotificationAuthorizationContext({
                id: userId,
                role: auth.user.role,
            }),
            "notification.inbox.read",
        );
        assertNotificationCapabilityScope(authorization, "OWN");

        const { notifications, unreadCount } = await listLatestForUser(
            authorization.actor.userId,
        );

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        if (error instanceof NotificationCapabilityDeniedError) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.forbidden },
                { status: 403 },
            );
        }
        console.error("Error fetching notifications:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchNotifications },
            { status: 500 },
        );
    }
}
