import { NOTIFICATION_MODULES, notificationSubject } from "@/shared/notifications/presentation";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    STOCK_DASHBOARD_TABS,
    toDashboardStockTabPath,
} from "@/lib/ssot/routes";
import { sendEmail } from "@/lib/email/transport";
import type { EmailData } from "@/lib/email/types";
import {
    generateStockRequestResultEmailHTML,
    generateStockRequestResultEmailText,
} from "./email-template/stock-request-result";
import type { StockRequestResultEmailPayload } from "./notification-payloads";

const STOCK_EMAIL_FROM_NAME = NOTIFICATION_MODULES.Stock.sender;

function buildStockRequestResultMessageId(
    data: StockRequestResultEmailPayload,
): string {
    const safeRequestId = String(data.requestId).replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeStatus = data.status.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, "-");
    return `<nhf-stock-request-${safeRequestId}-${safeStatus}@notifications.thainhf.org>`;
}

export async function sendStockRequestResultNotification(
    data: StockRequestResultEmailPayload,
): Promise<boolean> {
    const dashboardUrl = `${getPublicOrigin()}${toDashboardStockTabPath(STOCK_DASHBOARD_TABS.myRequests)}`;
    const emailData: EmailData = {
        to: data.recipient.email,
        subject: data.status === "ISSUED"
            ? notificationSubject("Stock", `คำขอเบิกวัสดุ #${data.requestId} ถูกจ่ายแล้ว`)
            : notificationSubject("Stock", `คำขอเบิกวัสดุ #${data.requestId} ถูกยกเลิก`),
        html: generateStockRequestResultEmailHTML(data, dashboardUrl),
        text: generateStockRequestResultEmailText(data, dashboardUrl),
        messageId: buildStockRequestResultMessageId(data),
        fromName: STOCK_EMAIL_FROM_NAME,
    };

    return sendEmail(emailData);
}
