import nodemailer from "nodemailer";
import { type TicketEmailData } from "@/types/api";
import {
    getTicketStatusLabel,
    getTicketPriorityLabel,
} from "@/lib/helpers/ticket-helpers";
import { type EmailData } from "./types";
import { generateNewTicketEmailHTML } from "./templates/new-ticket";
import { generateStatusUpdateEmailHTML } from "./templates/status-update";

// Create transporter (singleton pattern using closure)
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
    const emailData: EmailData = {
        to: ticketData.reportedBy.email,
        subject: `[NHF IT] Ticket #${ticketData.ticketId} ถูกสร้างแล้ว - ${ticketData.title}`,
        html: generateNewTicketEmailHTML(ticketData),
        text: `Ticket #${ticketData.ticketId} ถูกสร้างแล้ว\n\nหัวข้อ: ${
            ticketData.title
        }\nคำอธิบาย: ${ticketData.description}\nสถานะ: ${getTicketStatusLabel(
            ticketData.status
        )}\nความสำคัญ: ${getTicketPriorityLabel(
            ticketData.priority
        )}\n\nดู Ticket ได้ที่: ${
            process.env.NEXTAUTH_URL
        }/dashboard/it-issues`,
    };

    return await sendEmail(emailData);
}

export async function sendStatusUpdateNotification(
    ticketData: TicketEmailData,
    oldStatus: string
): Promise<boolean> {
    const emailData: EmailData = {
        to: ticketData.reportedBy.email,
        subject: `[NHF IT] อัพเดทสถานะ Ticket #${
            ticketData.ticketId
        } - ${getTicketStatusLabel(ticketData.status)}`,
        html: generateStatusUpdateEmailHTML(ticketData, oldStatus),
        text: `สถานะ Ticket #${
            ticketData.ticketId
        } ได้รับการอัพเดท\n\nหัวข้อ: ${
            ticketData.title
        }\nสถานะเดิม: ${getTicketStatusLabel(
            oldStatus
        )}\nสถานะใหม่: ${getTicketStatusLabel(
            ticketData.status
        )}\n\nดู Ticket ได้ที่: ${
            process.env.NEXTAUTH_URL
        }/dashboard/it-issues`,
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

    const emailData: EmailData = {
        to: itTeamEmail,
        subject: `[NHF IT] Ticket ${
            ticketData.priority === "URGENT" ? "เร่งด่วน" : "ความสำคัญสูง"
        } #${ticketData.ticketId} - ${ticketData.title}`,
        html: generateNewTicketEmailHTML(ticketData),
        text: `Ticket ใหม่ที่ต้องให้ความสำคัญ\n\nTicket #${
            ticketData.ticketId
        }\nหัวข้อ: ${ticketData.title}\nผู้แจ้ง: ${
            ticketData.reportedBy.name
        }\nความสำคัญ: ${getTicketPriorityLabel(
            ticketData.priority
        )}\n\nดู Ticket ได้ที่: ${
            process.env.NEXTAUTH_URL
        }/dashboard/it-issues`,
    };

    return await sendEmail(emailData);
}

// Export as object for backward compatibility
export const emailService = {
    sendEmail,
    sendNewTicketNotification,
    sendStatusUpdateNotification,
    sendITTeamNotification,
};

export type { EmailData };
