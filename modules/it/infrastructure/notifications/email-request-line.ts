import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";
import {
    sendAppLineNotification,
    type AppLineNotificationResult,
} from "@/lib/line/app-notification";

import { generateEmailRequestFlexMessage } from "./email-request-flex";
import { isUnavailableITLineDestination } from "./line-destination";

export type EmailRequestLineNotificationResult = AppLineNotificationResult
    | { readonly status: "SKIPPED"; readonly reason: "INVALID_DESTINATION" };

export async function sendEmailRequestLineNotification(input: {
    readonly userId: number;
    readonly emailRequestId: number | null;
    readonly retryKey: string;
}): Promise<EmailRequestLineNotificationResult> {
    let actionUrl: string;
    try {
        actionUrl = new URL(
            APP_ROUTES.dashboardEmailRequest,
            getPublicOrigin(),
        ).toString();
    } catch (error) {
        if (isUnavailableITLineDestination(error)) {
            return { status: "SKIPPED", reason: "INVALID_DESTINATION" };
        }
        throw error;
    }

    return sendAppLineNotification({
        userId: input.userId,
        message: generateEmailRequestFlexMessage(
            input.emailRequestId,
            actionUrl,
        ),
        retryKey: input.retryKey,
    });
}
