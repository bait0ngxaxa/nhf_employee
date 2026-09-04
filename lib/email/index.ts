import type { StockRequestResultEmailPayload } from "@/modules/stock";
import {
    sendLeaveActionNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveResultNotification,
} from "@/modules/leave";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    STOCK_DASHBOARD_TABS,
    toDashboardStockTabPath,
} from "@/lib/ssot/routes";
import {
    generateStockRequestResultEmailHTML,
    generateStockRequestResultEmailText,
} from "./templates/stock-request-result";
import { sendEmail } from "./transport";
import type { EmailData } from "./types";

const STOCK_EMAIL_FROM_NAME = "ระบบเบิกวัสดุ NHFapp";

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
            ? `[NHF Stock] คำขอเบิก #${data.requestId} ถูกจ่ายเรียบร้อยแล้ว`
            : `[NHF Stock] คำขอเบิก #${data.requestId} ถูกยกเลิก`,
        html: generateStockRequestResultEmailHTML(data, dashboardUrl),
        text: generateStockRequestResultEmailText(data, dashboardUrl),
        messageId: buildStockRequestResultMessageId(data),
        fromName: STOCK_EMAIL_FROM_NAME,
    };

    return sendEmail(emailData);
}

export { sendEmail } from "./transport";
export {
    sendLeaveActionNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveResultNotification,
} from "@/modules/leave";

export const emailService = {
    sendEmail,
    sendStockRequestResultNotification,
    sendLeaveActionNotification,
    sendLeaveResultNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
};

export type { EmailData } from "./types";
