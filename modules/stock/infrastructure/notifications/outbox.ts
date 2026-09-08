import type { NotificationOutbox } from "@prisma/client";

import { sendStockRequestResultNotification } from "./email";
import {
    dispatchStockRequestResultLineOutbox,
    sendStockLowNotification,
    sendStockRequestNotification,
} from "./line-notifications";
import {
    notifyAdminsLowStockInApp,
    notifyAdminsStockRequestLineInApp,
} from "./notifications";
import {
    parseStockLowLinePayload,
    parseStockRequestLinePayload,
    parseStockRequestResultEmailPayload,
} from "./notification-payloads";

function parsePayload(payload: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        throw new Error("Invalid payload JSON");
    }
}

function parseResultLinePayload(payload: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        return null;
    }
}

/**
 * Interprets Stock notification payloads while leaving claim, retry, and
 * terminal-state lifecycle transitions to the global Outbox Processor.
 */
export async function dispatchStockOutbox(
    notification: NotificationOutbox,
): Promise<"SENT" | "SUPERSEDED" | null> {
    if (notification.type === "STOCK_REQUEST_RESULT_LINE") {
        return dispatchStockRequestResultLineOutbox(
            notification,
            parseResultLinePayload(notification.payload),
        );
    }

    if (
        notification.type !== "STOCK_REQUEST_LINE" &&
        notification.type !== "STOCK_LOW_LINE" &&
        notification.type !== "STOCK_REQUEST_RESULT_EMAIL"
    ) {
        return null;
    }

    const payload = parsePayload(notification.payload);

    switch (notification.type) {
        case "STOCK_REQUEST_LINE": {
            const parsedPayload = parseStockRequestLinePayload(payload);
            await notifyAdminsStockRequestLineInApp(parsedPayload);
            if (!(await sendStockRequestNotification(parsedPayload))) {
                throw new Error("LINE stock notification failed");
            }
            return "SENT";
        }
        case "STOCK_LOW_LINE": {
            const parsedPayload = parseStockLowLinePayload(payload);
            await notifyAdminsLowStockInApp(parsedPayload);
            if (!(await sendStockLowNotification(parsedPayload))) {
                throw new Error("LINE low stock notification failed");
            }
            return "SENT";
        }
        case "STOCK_REQUEST_RESULT_EMAIL": {
            const parsedPayload = parseStockRequestResultEmailPayload(payload);
            if (!(await sendStockRequestResultNotification(parsedPayload))) {
                throw new Error("STOCK_REQUEST_RESULT_EMAIL failed");
            }
            return "SENT";
        }
        default:
            return null;
    }
}
