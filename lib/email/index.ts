import nodemailer from "nodemailer";
import type { TicketEmailData } from "@/types/api";
import {
    getTicketStatusLabel,
    getTicketPriorityLabel,
} from "@/lib/helpers/ticket-helpers";
import { type EmailData, type LeaveActionPayload, type LeaveResultPayload } from "./types";
import type {
    LeaveCancelledPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
} from "./types";
import { generateNewTicketEmailHTML } from "./templates/new-ticket";
import { generateStatusUpdateEmailHTML } from "./templates/status-update";
import { generateLeaveActionEmailHTML } from "./templates/leave-action";
import { generateLeaveResultEmailHTML } from "./templates/leave-result";
import { generateLeaveEventEmailHTML } from "./templates/leave-event";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    APP_DASHBOARD_TABS,
    toDashboardTabPath,
} from "@/lib/ssot/routes";

let transporter: nodemailer.Transporter | null = null;
let isTransporterReady = false;

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
                rejectUnauthorized: false,
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
        console.error("❌ SMTP connection verification failed:", error);
        isTransporterReady = false;

        // Reset and retry
        transporter = null;
        try {
            await getTransporter().verify();
            isTransporterReady = true;
            return true;
        } catch (retryError) {
            console.error("❌ SMTP connection failed after retry:", retryError);
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
                    from: `"NHF IT Support" <${process.env.SMTP_USER}>`,
                    to: emailData.to,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                });

                return true;
            } catch (sendError: unknown) {
                const errorMessage =
                    sendError instanceof Error
                        ? sendError.message
                        : "Unknown error";
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
                        sendError
                    );
                    return false;
                }

                const waitTime = Math.pow(2, attempt) * 1000;
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }
        }

        return false;
    } catch (error) {
        console.error("❌ Unexpected error in sendEmail:", error);
        return false;
    }
}

export async function sendNewTicketNotification(
    ticketData: TicketEmailData
): Promise<boolean> {
    const ticketUrl = `${getPublicOrigin()}/dashboard/it-issues`;
    const emailData: EmailData = {
        to: ticketData.reportedBy.email,
        subject: `[NHF IT] Ticket #${ticketData.ticketId} ถูกสร้างแล้ว - ${ticketData.title}`,
        html: generateNewTicketEmailHTML(ticketData, ticketUrl),
        text: `Ticket #${ticketData.ticketId} ถูกสร้างแล้ว\n\nหัวข้อ: ${
            ticketData.title
        }\nคำอธิบาย: ${ticketData.description}\nสถานะ: ${getTicketStatusLabel(
            ticketData.status
        )}\nความสำคัญ: ${getTicketPriorityLabel(
            ticketData.priority
        )}\n\nดู Ticket ได้ที่: ${ticketUrl}`,
    };

    return await sendEmail(emailData);
}

export async function sendStatusUpdateNotification(
    ticketData: TicketEmailData,
    oldStatus: string
): Promise<boolean> {
    const ticketUrl = `${getPublicOrigin()}/dashboard/it-issues`;
    const emailData: EmailData = {
        to: ticketData.reportedBy.email,
        subject: `[NHF IT] อัพเดทสถานะ Ticket #${
            ticketData.ticketId
        } - ${getTicketStatusLabel(ticketData.status)}`,
        html: generateStatusUpdateEmailHTML(ticketData, oldStatus, ticketUrl),
        text: `สถานะ Ticket #${
            ticketData.ticketId
        } ได้รับการอัพเดท\n\nหัวข้อ: ${
            ticketData.title
        }\nสถานะเดิม: ${getTicketStatusLabel(
            oldStatus
        )}\nสถานะใหม่: ${getTicketStatusLabel(
            ticketData.status
        )}\n\nดู Ticket ได้ที่: ${ticketUrl}`,
    };

    return await sendEmail(emailData);
}

export async function sendITTeamNotification(
    ticketData: TicketEmailData
): Promise<boolean> {
    const itTeamEmail = process.env.IT_TEAM_EMAIL;
    if (!itTeamEmail) {
        return false;
    }

    const ticketUrl = `${getPublicOrigin()}/dashboard/it-issues`;
    const emailData: EmailData = {
        to: itTeamEmail,
        subject: `[NHF IT] Ticket ${
            ticketData.priority === "URGENT" ? "เร่งด่วน" : "ความสำคัญสูง"
        } #${ticketData.ticketId} - ${ticketData.title}`,
        html: generateNewTicketEmailHTML(ticketData, ticketUrl),
        text: `Ticket ใหม่ที่ต้องให้ความสำคัญ\n\nTicket #${
            ticketData.ticketId
        }\nหัวข้อ: ${ticketData.title}\nผู้แจ้ง: ${
            ticketData.reportedBy.name
        }\nความสำคัญ: ${getTicketPriorityLabel(
            ticketData.priority
        )}\n\nดู Ticket ได้ที่: ${ticketUrl}`,
    };

    return await sendEmail(emailData);
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
    };

    return await sendEmail(emailData);
}

export async function sendLeaveResultNotification(
    data: LeaveResultPayload
): Promise<boolean> {
    const dashboardUrl = `${getPublicOrigin()}${toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const emailData: EmailData = {
        to: data.employee.email,
        subject: `[NHF Leave] ผลการพิจารณาคำขอลา: ${data.status === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ"}`,
        html: generateLeaveResultEmailHTML(data, dashboardUrl),
        text: `ผลการพิจารณาคำขอลา: ${data.status}\nเหตุผล: ${data.reason || "-"}`,
    };

    return await sendEmail(emailData);
}

export async function sendLeaveCancelledNotification(
    data: LeaveCancelledPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval)}`;
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
    };

    return sendEmail(emailData);
}

export async function sendLeaveNotTakenRequestedNotification(
    data: LeaveNotTakenRequestedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval)}`;
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
    };

    return sendEmail(emailData);
}

export async function sendLeaveNotTakenConfirmedNotification(
    data: LeaveNotTakenConfirmedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const approverName = data.approverName ?? "ผู้อนุมัติ";
    const emailData: EmailData = {
        to: data.employee.email,
        subject: "[NHF Leave] ยืนยันไม่ได้ใช้วันลาแล้ว",
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "ยืนยันไม่ได้ใช้วันลาแล้ว",
            intro: "ผู้อนุมัติยืนยันว่าคุณไม่ได้ใช้วันลาตามคำขอนี้แล้ว",
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูประวัติการลา",
            actorLabel: "ผู้อนุมัติ",
            actorName: approverName,
        }),
        text: `ยืนยันไม่ได้ใช้วันลาแล้ว\nผู้อนุมัติ: ${approverName}\nดูรายละเอียด: ${dashboardLink}`,
    };

    return sendEmail(emailData);
}

export const emailService = {
    sendEmail,
    sendNewTicketNotification,
    sendStatusUpdateNotification,
    sendITTeamNotification,
    sendLeaveActionNotification,
    sendLeaveResultNotification,
    sendLeaveCancelledNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveNotTakenConfirmedNotification,
};

export type { EmailData };
