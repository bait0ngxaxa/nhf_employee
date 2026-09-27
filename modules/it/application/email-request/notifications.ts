import type { Prisma } from "@prisma/client";

import { findActiveUsersWithConfiguredCapabilityScope } from "@/modules/authorization";
import { createForUserOnce } from "@/modules/notification";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { APP_DASHBOARD_TABS, toDashboardMenuPath } from "@/lib/ssot/routes";

import type {
    EmailRequestChannelOutboxPayloadV1,
    EmailRequestData,
} from "../../domain/email-request/contracts";

export function buildEmailRequestEmailEventKey(
    emailRequestId: number | null,
    parentOutboxId: number,
    recipientUserId: number,
): string {
    const sourceIdentity = emailRequestId === null
        ? `outbox:${parentOutboxId}`
        : String(emailRequestId);
    return `email-request:${sourceIdentity}:user:${recipientUserId}:email`;
}

export function buildEmailRequestLineEventKey(
    emailRequestId: number | null,
    parentOutboxId: number,
    recipientUserId: number,
): string {
    const sourceIdentity = emailRequestId === null
        ? `outbox:${parentOutboxId}`
        : String(emailRequestId);
    return `email-request:${sourceIdentity}:user:${recipientUserId}:line`;
}

function buildChannelIntents(
    emailRequestId: number | null,
    parentOutboxId: number,
    recipientUserIds: readonly number[],
): Prisma.NotificationOutboxCreateManyInput[] {
    return recipientUserIds.flatMap((recipientUserId) => {
        const payload: EmailRequestChannelOutboxPayloadV1 = {
            version: 1,
            emailRequestId,
            parentOutboxId,
            recipientUserId,
        };
        const serializedPayload = JSON.stringify(payload);

        return [
            {
                type: "EMAIL_REQUEST_EMAIL" as const,
                eventKey: buildEmailRequestEmailEventKey(
                    emailRequestId,
                    parentOutboxId,
                    recipientUserId,
                ),
                payload: serializedPayload,
            },
            {
                type: "EMAIL_REQUEST_LINE" as const,
                eventKey: buildEmailRequestLineEventKey(
                    emailRequestId,
                    parentOutboxId,
                    recipientUserId,
                ),
                payload: serializedPayload,
            },
        ];
    });
}

/** Atomically creates one Inbox row and two independently retryable intents per configured reader. */
export async function enqueueEmailRequestNotificationChannels(
    emailRequestId: number | null,
    parentOutboxId: number,
    payload: EmailRequestData,
): Promise<void> {
    await runSerializableTransaction(async (tx) => {
        const recipientUserIds = await findActiveUsersWithConfiguredCapabilityScope({
            capability: "email.request.read",
            scope: "ALL",
        }, tx);

        for (const userId of recipientUserIds) {
            await createForUserOnce({
                userId,
                type: "SYSTEM_ALERT",
                title: "มีคำขออีเมลพนักงานใหม่",
                message: `${payload.thaiName} (${payload.position}, ${payload.department}) ส่งคำขออีเมลพนักงานใหม่`,
                actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.emailRequest),
                referenceId: payload.replyEmail,
                dedupeKey: `email-request:${payload.replyEmail}:${payload.requestedAt}:${userId}`,
            }, tx);
        }

        const data = buildChannelIntents(
            emailRequestId,
            parentOutboxId,
            recipientUserIds,
        );
        if (data.length > 0) {
            await tx.notificationOutbox.createMany({
                data,
                skipDuplicates: true,
            });
        }
    });
}
