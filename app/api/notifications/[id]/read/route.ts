import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function PATCH(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = parseInt(session.user.id, 10);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserSession, 400);
        }

        const resolvedParams = await params;
        const notificationId = resolvedParams.id;

        const notification = await prisma.notification.update({
            where: {
                id: notificationId,
                userId,
            },
            data: {
                isRead: true,
            },
        });

        return NextResponse.json({ success: true, notification });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return jsonError(COMMON_API_MESSAGES.failedToMarkNotificationAsRead, 500);
    }
}
