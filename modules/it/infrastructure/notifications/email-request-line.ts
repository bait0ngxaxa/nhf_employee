import { getPublicOrigin } from "@/lib/network/public-url";
import { sendLineBroadcast, sendLineMessage } from "@/lib/line";
import type { EmailRequestData } from "../../domain/email-request/contracts";
import { generateEmailRequestFlexMessage } from "./email-request-flex";

export async function sendEmailRequestLineNotification(
    data: EmailRequestData,
    retryKey: string,
): Promise<boolean> {
    const message = generateEmailRequestFlexMessage(data, getPublicOrigin());
    const teamUserId = process.env.LINE_IT_TEAM_USER_ID || "";
    if (teamUserId) return sendLineMessage(teamUserId, message, retryKey);
    return sendLineBroadcast(message, retryKey);
}
