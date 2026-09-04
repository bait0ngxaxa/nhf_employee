import nodemailer from "nodemailer";
import type { StockRequestResultEmailPayload } from "@/modules/stock";
import {
    type EmailData,
    type LeaveActionPayload,
    type LeaveResultPayload,
    type RoutineContractExpiryEmailData,
    type RoutineReminderEmailData,
} from "./types";
import type {
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveCancellationRequestedPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
} from "./types";
import { generateLeaveActionEmailHTML } from "./templates/leave-action";
import { generateLeaveResultEmailHTML } from "./templates/leave-result";
import { generateLeaveEventEmailHTML } from "./templates/leave-event";
import {
    generateStockRequestResultEmailHTML,
    generateStockRequestResultEmailText,
} from "./templates/stock-request-result";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    generateRoutineReminderEmailHTML,
    generateRoutineReminderEmailText,
} from "./templates/routine-reminder";
import {
    generateRoutineContractExpiryEmailHTML,
    generateRoutineContractExpiryEmailText,
} from "./templates/routine-contract-expiry";
import {
    APP_DASHBOARD_TABS,
    STOCK_DASHBOARD_TABS,
    toDashboardMenuPath,
    toDashboardStockTabPath,
} from "@/lib/ssot/routes";
import {
    formatLeaveDecisionActor,
    getLeaveTypeLabel,
} from "@/lib/services/leave/notification-format";

let transporter: nodemailer.Transporter | null = null;
let isTransporterReady = false;
const DEFAULT_EMAIL_FROM_NAME = "NHFapp";
const LEAVE_EMAIL_FROM_NAME = "ระบบลา NHFapp";
const STOCK_EMAIL_FROM_NAME = "ระบบเบิกวัสดุ NHFapp";
const ROUTINE_EMAIL_FROM_NAME = "ระบบ NHF Routine";

function getSafeErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return "Unknown error";
    }

    const smtpPassword = process.env.SMTP_PASS;
    if (!smtpPassword) {
        return error.message;
    }

    return error.message.split(smtpPassword).join("[REDACTED]");
}

type LeaveEmailEvent =
    | "action"
    | "result"
    | "cancelled"
    | "cancellation-requested"
    | "cancelled-after-approval"
    | "not-taken-requested"
    | "not-taken-confirmed";

function buildLeaveMessageId(
    event: LeaveEmailEvent,
    leaveId: string,
    recipientIdentity?: string,
): string {
    const safeLeaveId = leaveId.replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeRecipient = recipientIdentity?.replace(/[^a-zA-Z0-9._-]/g, "-");
    const recipientPart = safeRecipient ? `-${safeRecipient}` : "";
    return `<nhf-leave-${event}-${safeLeaveId}${recipientPart}@notifications.thainhf.org>`;
}

function buildStockRequestResultMessageId(
    data: StockRequestResultEmailPayload,
): string {
    const safeRequestId = String(data.requestId).replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeStatus = data.status.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, "-");
    return `<nhf-stock-request-${safeRequestId}-${safeStatus}@notifications.thainhf.org>`;
}

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: true,
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 5,
        });
    }
    return transporter;
}

async function verifyConnection(): Promise<boolean> {
    try {
        await getTransporter().verify();
        isTransporterReady = true;
        return true;
    } catch (error) {
        console.error(
            "❌ SMTP connection verification failed:",
            getSafeErrorMessage(error),
        );
        isTransporterReady = false;

        // Reset and retry
        transporter = null;
        try {
            await getTransporter().verify();
            isTransporterReady = true;
            return true;
        } catch (retryError) {
            console.error(
                "❌ SMTP connection failed after retry:",
                getSafeErrorMessage(retryError),
            );
            return false;
        }
    }
}

export async function sendEmail(emailData: EmailData): Promise<boolean> {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return false;
        }

        if (!isTransporterReady) {
            const connectionOk = await verifyConnection();
            if (!connectionOk) {
                console.error(
                    "❌ Cannot establish SMTP connection. Email not sent."
                );
                return false;
            }
        }

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                attempt++;

                await getTransporter().sendMail({
                    from: `"${emailData.fromName ?? DEFAULT_EMAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
                    to: emailData.to,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                    messageId: emailData.messageId,
                });

                return true;
            } catch (sendError: unknown) {
                const errorMessage = getSafeErrorMessage(sendError);
                const errorCode =
                    sendError instanceof Error && "code" in sendError
                        ? (sendError as Error & { code: string }).code
                        : undefined;
                console.error(
                    `❌ Email send attempt ${attempt} failed:`,
                    errorMessage
                );

                if (
                    errorCode === "ECONNRESET" ||
                    errorCode === "ETIMEDOUT" ||
                    errorCode === "ENOTFOUND"
                ) {
                    isTransporterReady = false;
                    transporter = null;
                    const reconnected = await verifyConnection();
                    if (!reconnected && attempt === maxRetries) {
                        console.error(
                            "❌ Failed to reconnect after all attempts"
                        );
                        return false;
                    }
                } else if (attempt === maxRetries) {
                    console.error(
                        "❌ Failed to send email after all attempts:",
                        errorMessage,
                    );
                    return false;
                }

                const waitTime = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }

        return false;
    } catch (error) {
        console.error(
            "❌ Unexpected error in sendEmail:",
            getSafeErrorMessage(error),
        );
        return false;
    }
}

function sendLeaveEmail(emailData: EmailData): Promise<boolean> {
    return sendEmail({ ...emailData, fromName: LEAVE_EMAIL_FROM_NAME });
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

function buildRoutineReminderMessageId(data: RoutineReminderEmailData): string {
    const safePart = (value: number | string): string =>
        String(value).replace(/[^a-zA-Z0-9._-]/g, "-");
    return `<nhf-routine-${safePart(data.occurrenceId)}-rule-${safePart(data.ruleId)}-user-${safePart(data.userId)}-v${safePart(data.reminderVersion)}@notifications.thainhf.org>`;
}

function buildRoutineReminderActionUrl(actionUrl: string): string {
    const origin = getPublicOrigin();
    const candidate = new URL(actionUrl, origin);
    return candidate.origin === origin ? candidate.toString() : origin;
}

export async function sendRoutineReminderNotification(
    data: RoutineReminderEmailData,
): Promise<boolean> {
    const actionUrl = buildRoutineReminderActionUrl(data.actionUrl);
    const subjectTitle = data.taskTitle.replace(/[\r\n]+/g, " ").trim();
    return sendEmail({
        to: data.to,
        subject: `[NHF Routine] งานใกล้ถึงกำหนด: ${subjectTitle}`,
        html: generateRoutineReminderEmailHTML({ ...data, actionUrl }),
        text: generateRoutineReminderEmailText({ ...data, actionUrl }),
        messageId: buildRoutineReminderMessageId(data),
        fromName: ROUTINE_EMAIL_FROM_NAME,
    });
}

function buildRoutineContractExpiryMessageId(
    data: RoutineContractExpiryEmailData,
): string {
    const safePart = (value: number | string): string =>
        String(value).replace(/[^a-zA-Z0-9._-]/g, "-");
    return `<nhf-routine-contract-${safePart(data.taskId)}-end-${safePart(data.contractEndDate)}-user-${safePart(data.userId)}@notifications.thainhf.org>`;
}

export async function sendRoutineContractExpiryNotification(
    data: RoutineContractExpiryEmailData,
): Promise<boolean> {
    const actionUrl = buildRoutineReminderActionUrl(data.actionUrl);
    const subjectTitle = data.taskTitle.replace(/[\r\n]+/g, " ").trim();
    return sendEmail({
        to: data.to,
        subject: `[NHF Routine] สัญญาใกล้สิ้นสุด: ${subjectTitle}`,
        html: generateRoutineContractExpiryEmailHTML({ ...data, actionUrl }),
        text: generateRoutineContractExpiryEmailText({ ...data, actionUrl }),
        messageId: buildRoutineContractExpiryMessageId(data),
        fromName: ROUTINE_EMAIL_FROM_NAME,
    });
}

export async function sendLeaveActionNotification(
    data: LeaveActionPayload,
    dashboardLink: string
): Promise<boolean> {
    const emailData: EmailData = {
        to: data.approver.email,
        subject: `[NHF Leave] คำขอลาใหม่จาก ${data.employee.name}`,
        html: generateLeaveActionEmailHTML(data, dashboardLink),
        text: `มีคำขอลาใหม่\nพนักงาน ${data.employee.name} ขอลา ${data.durationDays} วัน\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId(
            "action",
            data.leaveId,
            String(data.approver.userId),
        ),
    };

    return await sendLeaveEmail(emailData);
}

export async function sendLeaveResultNotification(
    data: LeaveResultPayload
): Promise<boolean> {
    const dashboardUrl = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const emailData: EmailData = {
        to: data.employee.email,
        subject: `[NHF Leave] ผลการพิจารณาคำขอลา: ${data.status === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ"}`,
        html: generateLeaveResultEmailHTML(data, dashboardUrl),
        text: `ผลการพิจารณาคำขอลา: ${data.status}\nเหตุผล: ${data.reason || "-"}`,
        messageId: buildLeaveMessageId("result", data.leaveId),
    };

    return await sendLeaveEmail(emailData);
}

export async function sendLeaveCancelledNotification(
    data: LeaveCancelledPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval)}`;
    const emailData: EmailData = {
        to: data.approver.email,
        subject: `[NHF Leave] ${data.employee.name} ยกเลิกคำขอลาแล้ว`,
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "คำขอลาถูกยกเลิก",
            intro: `${data.employee.name} ยกเลิกคำขอลาที่รออนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูรายการอนุมัติ",
        }),
        text: `${data.employee.name} ยกเลิกคำขอลาแล้ว\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId("cancelled", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveCancellationRequestedNotification(
    data: LeaveCancellationRequestedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval)}`;
    const emailData: EmailData = {
        to: data.approver.email,
        subject: `[NHF Leave] มีคำขอยกเลิกวันลาจาก ${data.employee.name}`,
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "มีคำขอยกเลิกวันลารอยืนยัน",
            intro: `${data.employee.name} ขอยกเลิก${getLeaveTypeLabel(data.leaveType)}ที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ตรวจสอบและยืนยัน",
            noteLabel: "เหตุผลการขอยกเลิก",
            note: data.note,
        }),
        text: `${data.employee.name} ขอยกเลิกคำขอลาที่อนุมัติแล้ว\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId(
            "cancellation-requested",
            data.leaveId,
            String(data.approver.userId),
        ),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveCancelledAfterApprovalNotification(
    data: LeaveCancelledAfterApprovalPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const decisionActor = formatLeaveDecisionActor(data);
    const emailData: EmailData = {
        to: data.employee.email,
        subject: "[NHF Leave] ยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย",
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "ยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย",
            intro: `${decisionActor} ยืนยันการยกเลิกวันลาที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูประวัติการลา",
            actorLabel: "ผู้ยืนยัน",
            actorName: decisionActor,
        }),
        text: `${decisionActor} ยืนยันการยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId(
            "cancelled-after-approval",
            data.leaveId,
        ),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveNotTakenRequestedNotification(
    data: LeaveNotTakenRequestedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval)}`;
    const emailData: EmailData = {
        to: data.approver.email,
        subject: `[NHF Leave] มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน`,
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน",
            intro: `${data.employee.name} แจ้งว่าไม่ได้ใช้วันลาที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ตรวจสอบและยืนยัน",
            noteLabel: "โน๊ตจากพนักงาน",
            note: data.note,
        }),
        text: `${data.employee.name} แจ้งไม่ได้ใช้วันลา\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId("not-taken-requested", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveNotTakenConfirmedNotification(
    data: LeaveNotTakenConfirmedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const decisionActor = formatLeaveDecisionActor(data);
    const emailData: EmailData = {
        to: data.employee.email,
        subject: "[NHF Leave] ยืนยันไม่ได้ใช้วันลาแล้ว",
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "ยืนยันไม่ได้ใช้วันลาแล้ว",
            intro: `${decisionActor} ยืนยันว่าคุณไม่ได้ใช้วันลาตามคำขอนี้แล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูประวัติการลา",
            actorLabel: "ผู้ยืนยัน",
            actorName: decisionActor,
        }),
        text: `${decisionActor} ยืนยันไม่ได้ใช้วันลาแล้ว\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId("not-taken-confirmed", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}

export const emailService = {
    sendEmail,
    sendStockRequestResultNotification,
    sendRoutineContractExpiryNotification,
    sendRoutineReminderNotification,
    sendLeaveActionNotification,
    sendLeaveResultNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
};

export type {
    EmailData,
    RoutineContractExpiryEmailData,
    RoutineReminderEmailData,
};
