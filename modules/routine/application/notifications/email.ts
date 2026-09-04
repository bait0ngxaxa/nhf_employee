import { sendEmail } from "@/lib/email";
import { getPublicOrigin } from "@/lib/network/public-url";
import type { EmailData } from "@/lib/email/types";

import {
    generateRoutineContractExpiryEmailHTML,
    generateRoutineContractExpiryEmailText,
} from "./routine-contract-expiry-email";
import {
    generateRoutineReminderEmailHTML,
    generateRoutineReminderEmailText,
} from "./routine-reminder-email";
import type {
    RoutineContractExpiryEmailData,
    RoutineReminderEmailData,
} from "./notification-types";

const ROUTINE_EMAIL_FROM_NAME = "ระบบ NHF Routine";

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
    const emailData: EmailData = {
        to: data.to,
        subject: `[NHF Routine] งานใกล้ถึงกำหนด: ${subjectTitle}`,
        html: generateRoutineReminderEmailHTML({ ...data, actionUrl }),
        text: generateRoutineReminderEmailText({ ...data, actionUrl }),
        messageId: buildRoutineReminderMessageId(data),
        fromName: ROUTINE_EMAIL_FROM_NAME,
    };
    return sendEmail(emailData);
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
    const emailData: EmailData = {
        to: data.to,
        subject: `[NHF Routine] สัญญาใกล้สิ้นสุด: ${subjectTitle}`,
        html: generateRoutineContractExpiryEmailHTML({ ...data, actionUrl }),
        text: generateRoutineContractExpiryEmailText({ ...data, actionUrl }),
        messageId: buildRoutineContractExpiryMessageId(data),
        fromName: ROUTINE_EMAIL_FROM_NAME,
    };
    return sendEmail(emailData);
}
