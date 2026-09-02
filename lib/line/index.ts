import {
    type EmailRequestData,
    type LineFlexMessage,
    type StockLowLineData,
    type StockRequestLineData,
} from "@/types/api";
import { type LineWebhookData } from "./types";
import { generateEmailRequestFlexMessage } from "./flex-messages/email-request";
import { generateStockLowFlexMessage } from "./flex-messages/stock-low";
import { generateStockRequestFlexMessage } from "./flex-messages/stock";
import { getPublicOrigin } from "@/lib/network/public-url";
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
    baseUrl: getPublicOrigin(),
    itTeamUserId: process.env.LINE_IT_TEAM_USER_ID || "",
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
    message: LineFlexMessage
): Promise<boolean> {
    return sendLineApiRequest(
        "https://api.line.me/v2/bot/message/broadcast",
        getConfig().stockChannelAccessToken,
        { messages: [message] },
    );
}

export async function sendLineWebhook(data: LineWebhookData): Promise<boolean> {
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

async function sendToITTeamOrBroadcast(
    flexMessage: LineFlexMessage,
    retryKey?: string,
): Promise<boolean> {
    const { itTeamUserId } = getConfig();

    if (itTeamUserId) {
        return await sendLineMessage(itTeamUserId, flexMessage, retryKey);
    } else {
        return await sendLineBroadcast(flexMessage, retryKey);
    }
}

export async function sendEmailRequestNotification(
    emailRequestData: EmailRequestData
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const flexMessage = generateEmailRequestFlexMessage(
        emailRequestData,
        baseUrl
    );

    return await sendToITTeamOrBroadcast(flexMessage);
}

export async function sendStockRequestNotification(
    stockRequestData: StockRequestLineData
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const flexMessage = generateStockRequestFlexMessage(
        stockRequestData,
        baseUrl
    );

    return await sendStockLineBroadcast(flexMessage);
}

export async function sendStockLowNotification(
    stockLowData: StockLowLineData
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const flexMessage = generateStockLowFlexMessage(stockLowData, baseUrl);

    return await sendStockLineBroadcast(flexMessage);
}

// Export as object for backward compatibility
export const lineNotificationService = {
    sendLineMessage,
    sendLineBroadcast,
    sendStockLineBroadcast,
    sendLineWebhook,
    sendEmailRequestNotification,
    sendStockLowNotification,
    sendStockRequestNotification,
};

export { sendLineAppMessage, sendLinePushMessage };
export {
    sendAppLineNotification,
    type AppLineNotificationResult,
    type SendAppLineNotificationInput,
} from "./app-notification";
export type { LineWebhookData };
