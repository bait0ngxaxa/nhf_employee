import type { LineFlexMessage } from "@/types/api";
import {
    sendLineApiRequest,
    sendLineAppMessage,
    sendLinePushMessage,
} from "./messaging";

// Configuration (read once)
const getConfig = () => ({
    channelAccessToken: process.env.LINE_IT_CHANNEL_ACCESS_TOKEN || "",
    stockChannelAccessToken: process.env.LINE_STOCK_CHANNEL_ACCESS_TOKEN || "",
    lineWebhookUrl: process.env.LINE_WEBHOOK_URL || "",
});

export async function sendLineMessage(
    userId: string,
    message: LineFlexMessage,
    retryKey?: string,
): Promise<boolean> {
    return sendLinePushMessage({
        channelAccessToken: getConfig().channelAccessToken,
        userId,
        message,
        retryKey,
    });
}

export async function sendLineBroadcast(
    message: LineFlexMessage,
    retryKey?: string,
): Promise<boolean> {
    return sendLineApiRequest(
        "https://api.line.me/v2/bot/message/broadcast",
        getConfig().channelAccessToken,
        { messages: [message] },
        retryKey,
    );
}

export async function sendStockLineBroadcast(
    message: LineFlexMessage,
    retryKey?: string,
): Promise<boolean> {
    return sendLineApiRequest(
        "https://api.line.me/v2/bot/message/broadcast",
        getConfig().stockChannelAccessToken,
        { messages: [message] },
        retryKey,
    );
}

/**
 * Send the retained legacy outbound webhook compatibility payload.
 *
 * This is separate from the inbound signature-verification route at
 * /api/line/webhook and remains for an externally configured integration.
 */
export async function sendLineWebhook(data: unknown): Promise<boolean> {
    const { lineWebhookUrl } = getConfig();

    if (!lineWebhookUrl) {
        return false;
    }

    try {
        const response = await fetch(lineWebhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            return true;
        }

        const errorText = await response.text();
        console.error(
            "❌ LINE Webhook ส่งไม่สำเร็จ:",
            response.status,
            errorText
        );
        return false;
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดใน LINE Webhook:", error);
        return false;
    }
}

// Export as object for backward compatibility
export const lineNotificationService = {
    sendLineMessage,
    sendLineBroadcast,
    sendStockLineBroadcast,
    sendLineWebhook,
};

export { sendLineAppMessage, sendLinePushMessage };
export {
    sendAppLineNotification,
    type AppLineNotificationResult,
    type SendAppLineNotificationInput,
} from "./app-notification";
