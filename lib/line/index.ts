import {
    type LineNotificationData,
    type EmailRequestData,
    type TicketEmailData,
    type LineFlexMessage,
} from "@/types/api";
import { type LineWebhookData } from "./types";
import { generateTicketFlexMessage } from "./flex-messages/ticket";
import { generateEmailRequestFlexMessage } from "./flex-messages/email-request";

// Configuration (read once)
const getConfig = () => ({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    lineWebhookUrl: process.env.LINE_WEBHOOK_URL || "",
    baseUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
    itTeamUserId: process.env.LINE_IT_TEAM_USER_ID || "",
});

export async function sendLineMessage(
    userId: string,
    message: LineFlexMessage
): Promise<boolean> {
    const { channelAccessToken } = getConfig();

    if (!channelAccessToken) {
        return false;
    }

    try {
        const response = await fetch(
            "https://api.line.me/v2/bot/message/push",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${channelAccessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    to: userId,
                    messages: [message],
                }),
            }
        );

        if (response.ok) {
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
    message: LineFlexMessage
): Promise<boolean> {
    const { channelAccessToken } = getConfig();

    if (!channelAccessToken) {
        return false;
    }

    try {
        const response = await fetch(
            "https://api.line.me/v2/bot/message/broadcast",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${channelAccessToken}`,
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
    flexMessage: LineFlexMessage
): Promise<boolean> {
    const { itTeamUserId } = getConfig();

    if (itTeamUserId) {
        return await sendLineMessage(itTeamUserId, flexMessage);
    } else {
        return await sendLineBroadcast(flexMessage);
    }
}

export async function sendNewTicketNotification(
    ticketData: TicketEmailData
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const lineData: LineNotificationData = { ...ticketData };
    const flexMessage = generateTicketFlexMessage(
        lineData,
        "new_ticket",
        baseUrl
    );

    return await sendToITTeamOrBroadcast(flexMessage);
}

export async function sendStatusUpdateNotification(
    ticketData: TicketEmailData
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const lineData: LineNotificationData = { ...ticketData };
    const flexMessage = generateTicketFlexMessage(
        lineData,
        "status_update",
        baseUrl
    );

    return await sendToITTeamOrBroadcast(flexMessage);
}

export async function sendITTeamNotification(
    ticketData: TicketEmailData
): Promise<boolean> {
    const { baseUrl } = getConfig();
    const lineData: LineNotificationData = { ...ticketData };
    const flexMessage = generateTicketFlexMessage(lineData, "it_team", baseUrl);

    return await sendToITTeamOrBroadcast(flexMessage);
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

// Export as object for backward compatibility
export const lineNotificationService = {
    sendLineMessage,
    sendLineBroadcast,
    sendLineWebhook,
    sendNewTicketNotification,
    sendStatusUpdateNotification,
    sendITTeamNotification,
    sendEmailRequestNotification,
};

export type { LineWebhookData };
