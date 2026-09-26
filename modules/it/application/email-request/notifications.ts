import { findActiveUsersWithConfiguredCapabilityScope } from "@/modules/authorization";
import { createForUserOnce } from "@/modules/notification";
import type { EmailRequestData } from "../../domain/email-request/contracts";
import { APP_DASHBOARD_TABS, toDashboardMenuPath } from "@/lib/ssot/routes";

export async function createEmailRequestInboxNotifications(
    payload: EmailRequestData,
): Promise<void> {
    const recipientUserIds = await findActiveUsersWithConfiguredCapabilityScope({
        capability: "email.request.read",
        scope: "ALL",
    });

    await Promise.all(
        recipientUserIds.map((userId) =>
            createForUserOnce({
                userId,
                type: "SYSTEM_ALERT",
                title: "มีคำขออีเมลพนักงานใหม่",
                message: `${payload.thaiName} (${payload.position}, ${payload.department}) ส่งคำขออีเมลพนักงานใหม่`,
                actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.emailRequest),
                referenceId: payload.replyEmail,
                dedupeKey: `email-request:${payload.replyEmail}:${payload.requestedAt}:${userId}`,
            }),
        ),
    );
}
