import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import {
    assertNotificationCapabilityForMigration,
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationContext,
    markReadForUser,
    NotificationCapabilityDeniedError,
} from "@/modules/notification";

export async function PATCH(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = parseInt(auth.session.user.id, 10);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserSession, 400);
        }

        const resolvedParams = await params;
        const notificationId = resolvedParams.id;

        const authorization = await assertNotificationCapabilityForMigration(
            buildNotificationAuthorizationContext({
                id: userId,
                role: auth.user.role,
            }),
            "notification.inbox.update",
        );
        assertNotificationCapabilityScope(authorization, "OWN");

        const notification = await markReadForUser(
            notificationId,
            authorization.actor.userId,
        );

        return NextResponse.json({ success: true, notification });
    } catch (error) {
        if (error instanceof NotificationCapabilityDeniedError) {
            return jsonError(COMMON_API_MESSAGES.forbidden, 403);
        }
        console.error("Error marking notification as read:", error);
        return jsonError(COMMON_API_MESSAGES.failedToMarkNotificationAsRead, 500);
    }
}
