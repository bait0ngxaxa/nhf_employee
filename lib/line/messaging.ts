import type { LineFlexMessage } from "@/types/api";

import { getLineMessagingConfig } from "./config";

async function sendLineApiRequest(
    endpoint: string,
    channelAccessToken: string,
    body: unknown,
    retryKey?: string,
): Promise<boolean> {
    if (!channelAccessToken) return false;

    const headers: Record<string, string> = {
        Authorization: `Bearer ${channelAccessToken}`,
        "Content-Type": "application/json",
    };
    if (retryKey) headers["X-Line-Retry-Key"] = retryKey;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (response.ok || (retryKey !== undefined && response.status === 409)) {
            return true;
        }

        console.error("LINE API request failed", {
            endpoint,
            status: response.status,
            hasRetryKey: retryKey !== undefined,
        });
        return false;
    } catch (error) {
        console.error("LINE API request error", {
            endpoint,
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return false;
    }
}

export async function sendLinePushMessage(input: {
    channelAccessToken: string;
    userId: string;
    message: LineFlexMessage;
    retryKey?: string;
}): Promise<boolean> {
    return sendLineApiRequest(
        "https://api.line.me/v2/bot/message/push",
        input.channelAccessToken,
        { to: input.userId, messages: [input.message] },
        input.retryKey,
    );
}

export async function sendLineAppMessage(
    userId: string,
    message: LineFlexMessage,
    retryKey: string,
): Promise<boolean> {
    let channelAccessToken: string;
    try {
        ({ channelAccessToken } = getLineMessagingConfig());
    } catch {
        return false;
    }

    return sendLinePushMessage({
        channelAccessToken,
        userId,
        message,
        retryKey,
    });
}

export { sendLineApiRequest };
