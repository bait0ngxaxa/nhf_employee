import { generateNotificationEmailHTML } from "@/lib/email/templates/notification";
import type { NotificationStatus } from "@/shared/notifications/presentation";

export interface ITNotificationEmailTemplateData {
    readonly categoryLabel: string;
    readonly title: string;
    readonly intro: string;
    readonly referenceLabel: string;
    readonly referenceValue: string;
    readonly actionLabel: string;
    readonly actionUrl: string;
    readonly status?: NotificationStatus;
}

export function generateITNotificationEmailHTML(data: ITNotificationEmailTemplateData): string {
    return generateNotificationEmailHTML({
        module: "IT",
        categoryLabel: data.categoryLabel,
        title: data.title,
        intro: data.intro,
        preheader: `${data.intro} ${data.referenceLabel}: ${data.referenceValue}`,
        details: [{ label: data.referenceLabel, value: data.referenceValue }],
        actionLabel: data.actionLabel,
        actionUrl: data.actionUrl,
        status: data.status,
    });
}
