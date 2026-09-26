import type { Prisma } from "@prisma/client";

import {
    buildITTicketLineEventKey,
    buildITTicketNotificationEventKey,
    isITTicketRequesterLineNotification,
    type ITTicketNotificationPayloadV1,
} from "../../domain/ticket-notification";

type ITTicketNotificationOutboxContext = Pick<
    Prisma.TransactionClient,
    "notificationOutbox"
>;

export async function enqueueITTicketNotificationIntents(
    tx: ITTicketNotificationOutboxContext,
    payloads: readonly ITTicketNotificationPayloadV1[],
): Promise<void> {
    if (payloads.length === 0) return;

    const data = payloads.flatMap((payload) => {
        const serializedPayload = JSON.stringify(payload);
        const intents: Prisma.NotificationOutboxCreateManyInput[] = [{
            type: "IT_TICKET_IN_APP" as const,
            eventKey: buildITTicketNotificationEventKey(payload),
            payload: serializedPayload,
        }];

        if (isITTicketRequesterLineNotification(payload)) {
            intents.push({
                type: "IT_TICKET_LINE",
                eventKey: buildITTicketLineEventKey(payload),
                payload: serializedPayload,
            });
        }

        return intents;
    });

    await tx.notificationOutbox.createMany({
        data,
        skipDuplicates: true,
    });
}
