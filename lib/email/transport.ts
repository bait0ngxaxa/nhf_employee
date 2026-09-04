import nodemailer from "nodemailer";

import type { EmailData } from "./types";

let transporter: nodemailer.Transporter | null = null;
let isTransporterReady = false;
const DEFAULT_EMAIL_FROM_NAME = "NHFapp";

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
