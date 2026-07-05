import { prisma } from "@/lib/db/prisma";
import { createInAppNotificationOnce } from "@/lib/services/notifications/in-app";
import type { EmailRequestData } from "@/types/api";

export const EMAIL_REQUEST_INAPP_RECIPIENTS_ENV =
    "EMAIL_REQUEST_INAPP_RECIPIENT_EMAILS";

function parseRecipientEmails(value: string | undefined): string[] {
    if (!value) {
        return [];
    }

    const recipientEmails = new Set<string>();
    for (const email of value.split(",")) {
        const trimmedEmail = email.trim();
        if (trimmedEmail) {
            recipientEmails.add(trimmedEmail);
        }
    }

    return [...recipientEmails];
}

async function getEmailRequestRecipientUserIds(): Promise<number[]> {
    const recipientEmails = parseRecipientEmails(
        process.env[EMAIL_REQUEST_INAPP_RECIPIENTS_ENV],
    );

    if (recipientEmails.length === 0) {
        return [];
    }

    const recipients = await prisma.user.findMany({
        where: {
            email: { in: recipientEmails },
            isActive: true,
            deletedAt: null,
        },
        select: { id: true },
    });

    return recipients.map((recipient) => recipient.id);
}

export async function createEmailRequestInAppNotification(
    payload: EmailRequestData,
): Promise<void> {
    const recipientUserIds = await getEmailRequestRecipientUserIds();

    await Promise.all(
        recipientUserIds.map((userId) =>
            createInAppNotificationOnce({
                userId,
                type: "SYSTEM_ALERT",
                title: "มีคำขออีเมลพนักงานใหม่",
                message: `${payload.thaiName} (${payload.position}, ${payload.department}) ส่งคำขออีเมลพนักงานใหม่`,
                actionUrl: "/dashboard?tab=email-request",
                referenceId: payload.replyEmail,
                dedupeKey: `email-request:${payload.replyEmail}:${payload.requestedAt}:${userId}`,
            }),
        ),
    );
}
