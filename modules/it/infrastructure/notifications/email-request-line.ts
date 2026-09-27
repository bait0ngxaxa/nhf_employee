import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";
import {
    sendAppLineNotification,
    type AppLineNotificationResult,
} from "@/lib/line/app-notification";

import { generateEmailRequestFlexMessage } from "./email-request-flex";

export type EmailRequestLineNotificationResult = AppLineNotificationResult;

export async function sendEmailRequestLineNotification(input: {
    readonly userId: number;
    readonly emailRequestId: number | null;
    readonly retryKey: string;
}): Promise<EmailRequestLineNotificationResult> {
    const actionUrl = new URL(
        APP_ROUTES.dashboardEmailRequest,
        getPublicOrigin(),
    ).toString();

    return sendAppLineNotification({
        userId: input.userId,
        message: generateEmailRequestFlexMessage(
            input.emailRequestId,
            actionUrl,
        ),
        retryKey: input.retryKey,
    });
}
