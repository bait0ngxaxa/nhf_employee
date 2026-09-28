import type { EmailData } from "./types";
import { sendMicrosoftGraphEmail } from "./microsoft-graph";
import { sendSmtpEmail } from "./smtp";

export async function sendEmail(emailData: EmailData): Promise<boolean> {
    const provider = process.env.EMAIL_PROVIDER ?? "microsoft-graph";

    switch (provider) {
        case "microsoft-graph":
            return sendMicrosoftGraphEmail(emailData);
        case "smtp":
            return sendSmtpEmail(emailData);
        default:
            console.error(
                "Unsupported EMAIL_PROVIDER configuration; email not sent.",
            );
            return false;
    }
}
