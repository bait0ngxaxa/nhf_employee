import type { NotificationOutbox } from "@prisma/client";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { sendAppLineNotification } from "@/lib/line/app-notification";
import { generateStockRequestResultFlexMessage } from "@/lib/line/flex-messages/stock-request-result";
import { buildStockLiffRequestUrl } from "@/lib/line/stock-links";
import {
    parseStockRequestResultLinePayload,
    type StockRequestResultLinePayload,
} from "./notification-payloads";

export const STOCK_REQUEST_RESULT_LINE_OUTBOX_TYPE =
    "STOCK_REQUEST_RESULT_LINE" as const;

export function buildStockRequestResultLineEventKey(
    requestId: number,
    status: StockRequestResultLinePayload["status"],
): string {
    return `stock-request:${requestId}:${status}:line`;
}

async function markStockLineSuperseded(
    notificationId: number,
    lastError: string,
): Promise<void> {
    await runSerializableTransaction((tx) =>
        tx.notificationOutbox.updateMany({
            where: { id: notificationId, status: "PROCESSING" },
            data: { status: "SUPERSEDED", lastError },
        }),
    );
}

export async function dispatchStockRequestResultLineOutbox(
    notification: NotificationOutbox,
    value: unknown,
): Promise<"SENT" | "SUPERSEDED" | null> {
    if (notification.type !== STOCK_REQUEST_RESULT_LINE_OUTBOX_TYPE) {
        return null;
    }

    let payload: StockRequestResultLinePayload;
    try {
        payload = parseStockRequestResultLinePayload(value);
    } catch {
        await markStockLineSuperseded(
            notification.id,
            "Superseded invalid Stock request result LINE payload",
        );
        return "SUPERSEDED";
    }

    if (
        notification.eventKey !== buildStockRequestResultLineEventKey(
            payload.requestId,
            payload.status,
        )
    ) {
        await markStockLineSuperseded(
            notification.id,
            "Superseded mismatched Stock request result LINE event key",
        );
        return "SUPERSEDED";
    }

    const claimed = await runSerializableTransaction((tx) =>
        tx.notificationOutbox.findFirst({
            where: { id: notification.id, status: "PROCESSING" },
            select: { id: true },
        }),
    );
    if (!claimed) return "SUPERSEDED";

    try {
        const result = await sendAppLineNotification({
            userId: payload.recipient.userId,
            message: generateStockRequestResultFlexMessage(
                payload,
                buildStockLiffRequestUrl(payload.requestId),
            ),
            retryKey: payload.retryKey,
        });
        if (result.status === "SKIPPED") {
            await markStockLineSuperseded(
                notification.id,
                "Superseded Stock request result LINE delivery for unavailable recipient",
            );
            return "SUPERSEDED";
        }
    } catch {
        throw new Error("Stock request result LINE delivery failed");
    }

    return "SENT";
}
