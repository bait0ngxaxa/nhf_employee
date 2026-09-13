import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    assertNotificationCapabilityForMigration,
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationContext,
    markAllReadForUser,
    NotificationCapabilityDeniedError,
} from "@/modules/notification";

export async function POST(_req: NextRequest): Promise<NextResponse> {
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
            "notification.inbox.update",
        );
        assertNotificationCapabilityScope(authorization, "OWN");

        const updatedCount = await markAllReadForUser(
            authorization.actor.userId,
        );

        return NextResponse.json({ success: true, updatedCount });
    } catch (error) {
        if (error instanceof NotificationCapabilityDeniedError) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.forbidden },
                { status: 403 },
            );
        }
        console.error("Error marking all notifications as read:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToMarkAllNotificationsAsRead },
            { status: 500 },
        );
    }
}
