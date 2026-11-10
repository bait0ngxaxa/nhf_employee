import nodemailer, { type Transporter } from "nodemailer";

import { OUTBOUND_SMTP_TIMEOUTS } from "@/lib/network/outbound-http";

import type { EmailData } from "./types";

/** sendMail attempts inside one sendSmtpEmail call (2s/4s/8s backoff between). */
export const SMTP_MAX_SEND_ATTEMPTS = 3;

let transporter: Transporter | null = null;
let isTransporterReady = false;
const DEFAULT_EMAIL_FROM_NAME = "NHFapp";

function getSafeErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return "Unknown error";
    }

    let message = error.message;
    const secrets = [
        process.env.SMTP_PASS,
        process.env.MICROSOFT_CLIENT_SECRET,
    ].filter((secret): secret is string => Boolean(secret));

    for (const secret of secrets) {
        message = message.split(secret).join("[REDACTED]");
    }

    return message;
}

function getTransporter(): Transporter {
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
            // Timeouts reject with code ETIMEDOUT and use the existing
            // retry/false path below. socketTimeout is idle-only (see constant).
            ...OUTBOUND_SMTP_TIMEOUTS,
        });
    }
    return transporter;
}

/**
 * Drops the cached transporter, closing its pooled connections first so a
 * replaced pool does not linger. close() is synchronous in nodemailer 10.x
 * (Mailer.close: () => void); any failure is swallowed so cleanup can never
 * throw into the send path.
 */
function discardTransporter(): void {
    const previous = transporter;
    transporter = null;
    if (!previous) return;

    try {
        previous.close();
    } catch (error) {
        console.error(
            "❌ SMTP transporter close failed:",
            getSafeErrorMessage(error),
        );
    }
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

        discardTransporter();
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

export async function sendSmtpEmail(emailData: EmailData): Promise<boolean> {
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

        const maxRetries = SMTP_MAX_SEND_ATTEMPTS;
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
                    discardTransporter();
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
