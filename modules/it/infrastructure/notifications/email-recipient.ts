import { z } from "zod";

const itNotificationEmailSchema = z.string()
    .trim()
    .max(320)
    .email()
    .refine((value) => !value.toLowerCase().endsWith("@temp.local"))
    .refine((value) => !/[\r\n]/.test(value));

/** Normalize trusted User.email data before using it as an SMTP recipient. */
export function normalizeITNotificationEmail(
    email: string | null | undefined,
): string | null {
    if (typeof email !== "string") return null;
    const parsed = itNotificationEmailSchema.safeParse(email);
    return parsed.success ? parsed.data.toLowerCase() : null;
}
