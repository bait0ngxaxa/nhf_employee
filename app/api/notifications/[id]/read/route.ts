import { type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

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
