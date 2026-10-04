import { getEmailRequestNotificationContent } from "../../domain/email-request/notification-content";
import type { Prisma } from "@prisma/client";

import { findActiveUsersWithConfiguredCapabilityScope } from "@/modules/authorization";
import { createForUserOnce } from "@/modules/notification";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { APP_DASHBOARD_TABS, toDashboardMenuPath } from "@/lib/ssot/routes";

import type {
    EmailRequestChannelOutboxPayloadV1,
    EmailRequestData,
    EmailRequestAccessUpdatedData,
} from "../../domain/email-request/contracts";

export function buildEmailRequestEmailEventKey(
    emailRequestId: number | null,
    parentOutboxId: number,
    recipientUserId: number,
    accessVersion?: number,
): string {
    const sourceIdentity = emailRequestId === null
        ? `outbox:${parentOutboxId}`
        : String(emailRequestId);
    const eventIdentity = accessVersion === undefined ? sourceIdentity : `${sourceIdentity}:access:${accessVersion}`;
    return `email-request:${eventIdentity}:user:${recipientUserId}:email`;
}

export function buildEmailRequestLineEventKey(
    emailRequestId: number | null,
    parentOutboxId: number,
    recipientUserId: number,
    accessVersion?: number,
): string {
    const sourceIdentity = emailRequestId === null
        ? `outbox:${parentOutboxId}`
        : String(emailRequestId);
    const eventIdentity = accessVersion === undefined ? sourceIdentity : `${sourceIdentity}:access:${accessVersion}`;
    return `email-request:${eventIdentity}:user:${recipientUserId}:line`;
}

function buildChannelIntents(
    emailRequestId: number | null,
    parentOutboxId: number,
    recipientUserIds: readonly number[],
    accessVersion?: number,
): Prisma.NotificationOutboxCreateManyInput[] {
    return recipientUserIds.flatMap((recipientUserId) => {
        const payload: EmailRequestChannelOutboxPayloadV1 = {
            version: 1,
            ...(accessVersion === undefined ? {} : { accessVersion }),
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
                    accessVersion,
                ),
                payload: serializedPayload,
            },
            {
                type: "EMAIL_REQUEST_LINE" as const,
                eventKey: buildEmailRequestLineEventKey(
                    emailRequestId,
                    parentOutboxId,
                    recipientUserId,
                    accessVersion,
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
    payload: EmailRequestData | EmailRequestAccessUpdatedData,
): Promise<void> {
    const accessVersion = "accessVersion" in payload ? payload.accessVersion : undefined;
    const content = getEmailRequestNotificationContent(accessVersion);
    await runSerializableTransaction(async (tx) => {
        const recipientUserIds = await findActiveUsersWithConfiguredCapabilityScope({
            capability: "email.request.read",
            scope: "ALL",
        }, tx);

        for (const userId of recipientUserIds) {
            await createForUserOnce({
                userId,
                type: "SYSTEM_ALERT",
                title: content.title,
                message: "accessVersion" in payload
                    ? `คำขอ #${emailRequestId} · ${content.summary}`
                    : `สำหรับ ${payload.thaiName} (${payload.position}, ${payload.department})`,
                actionUrl: toDashboardMenuPath(APP_DASHBOARD_TABS.emailRequest),
                referenceId: "accessVersion" in payload ? String(emailRequestId) : payload.replyEmail,
                dedupeKey: "accessVersion" in payload
                    ? `email-request:${emailRequestId}:access:${accessVersion}:user:${userId}`
                    : `email-request:${payload.replyEmail}:${payload.requestedAt}:${userId}`,
            }, tx);
        }

        const data = buildChannelIntents(
            emailRequestId,
            parentOutboxId,
            recipientUserIds,
            accessVersion,
        );
        if (data.length > 0) {
            await tx.notificationOutbox.createMany({
                data,
                skipDuplicates: true,
            });
        }
    });
}
