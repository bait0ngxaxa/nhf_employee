import {
    type LineNotificationData,
    type EmailRequestData,
    type TicketEmailData,
    type LineFlexMessage,
    type StockLowLineData,
    type StockRequestLineData,
} from "@/types/api";
import { type LineWebhookData } from "./types";
import { generateTicketFlexMessage } from "./flex-messages/ticket";
import { generateEmailRequestFlexMessage } from "./flex-messages/email-request";
import { generateStockLowFlexMessage } from "./flex-messages/stock-low";
import { generateStockRequestFlexMessage } from "./flex-messages/stock";
import { getPublicOrigin } from "@/lib/network/public-url";

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
    const { channelAccessToken } = getConfig();

    if (!channelAccessToken) {
        return false;
    }

    try {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${channelAccessToken}`,
            "Content-Type": "application/json",
        };
        if (retryKey) headers["X-Line-Retry-Key"] = retryKey;

        const response = await fetch(
            "https://api.line.me/v2/bot/message/push",
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    to: userId,
                    messages: [message],
                }),
            }
        );

        if (response.ok || (retryKey !== undefined && response.status === 409)) {
            return true;
        } else {
            const errorText = await response.text();
            console.error(
                "❌ LINE Message ส่งไม่สำเร็จ:",
                response.status,
                errorText
            );
            return false;
        }
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดใน LINE Message:", error);
        return false;
    }
}

export async function sendLineBroadcast(
    message: LineFlexMessage,
    retryKey?: string,
): Promise<boolean> {
    const { channelAccessToken } = getConfig();

    if (!channelAccessToken) {
        return false;
    }

    try {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${channelAccessToken}`,
            "Content-Type": "application/json",
        };
        if (retryKey) headers["X-Line-Retry-Key"] = retryKey;

        const response = await fetch(
            "https://api.line.me/v2/bot/message/broadcast",
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    messages: [message],
                }),
            }
        );

        if (response.ok || (retryKey !== undefined && response.status === 409)) {
            return true;
        } else {
            const errorText = await response.text();
            console.error(
                "❌ LINE Broadcast ส่งไม่สำเร็จ:",
                response.status,
                errorText
            );
            return false;
        }
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดใน LINE Broadcast:", error);
        return false;
    }
}

export async function sendStockLineBroadcast(
    message: LineFlexMessage
): Promise<boolean> {
    const { stockChannelAccessToken } = getConfig();

    if (!stockChannelAccessToken) {
        return false;
    }

    try {
        const response = await fetch(
            "https://api.line.me/v2/bot/message/broadcast",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stockChannelAccessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messages: [message],
                }),
            }
        );

        if (response.ok) {
            return true;
        } else {
            const errorText = await response.text();
            console.error(
                "LINE Stock Broadcast ส่งไม่สำเร็จ:",
                response.status,
                errorText
            );
            return false;
        }
    } catch (error) {
        console.error("เกิดข้อผิดพลาดใน LINE Stock Broadcast:", error);
        return false;
    }
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
        } else {
            const errorText = await response.text();
            console.error(
                "❌ LINE Webhook ส่งไม่สำเร็จ:",
                response.status,
                errorText
            );
            return false;
        }
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

export async function sendNewTicketNotification(
    ticketData: TicketEmailData,
    retryKey?: string,
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const lineData: LineNotificationData = { ...ticketData };
    const flexMessage = generateTicketFlexMessage(
        lineData,
        "new_ticket",
        baseUrl
    );

    return await sendToITTeamOrBroadcast(flexMessage, retryKey);
}

export async function sendStatusUpdateNotification(
    ticketData: TicketEmailData,
    retryKey?: string,
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const lineData: LineNotificationData = { ...ticketData };
    const flexMessage = generateTicketFlexMessage(
        lineData,
        "status_update",
        baseUrl
    );

    return await sendToITTeamOrBroadcast(flexMessage, retryKey);
}

export async function sendITTeamNotification(
    ticketData: TicketEmailData,
    retryKey?: string,
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const lineData: LineNotificationData = { ...ticketData };
    const flexMessage = generateTicketFlexMessage(lineData, "it_team", baseUrl);

    return await sendToITTeamOrBroadcast(flexMessage, retryKey);
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
    sendNewTicketNotification,
    sendStatusUpdateNotification,
    sendITTeamNotification,
    sendEmailRequestNotification,
    sendStockLowNotification,
    sendStockRequestNotification,
};

export type { LineWebhookData };
