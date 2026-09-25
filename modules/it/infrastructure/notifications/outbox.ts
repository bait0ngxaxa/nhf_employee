import type { Prisma } from "@prisma/client";

import {
    buildITTicketNotificationEventKey,
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

    await tx.notificationOutbox.createMany({
        data: payloads.map((payload) => ({
            type: "IT_TICKET_IN_APP",
            eventKey: buildITTicketNotificationEventKey(payload),
            payload: JSON.stringify(payload),
        })),
        skipDuplicates: true,
    });
}
