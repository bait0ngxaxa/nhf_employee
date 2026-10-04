import type { LineFlexComponent, LineFlexMessage } from "@/types/api";
import { NOTIFICATION_MODULES, notificationAltText, type NotificationModule } from "@/shared/notifications/presentation";

interface NotificationFlexData {
    readonly module: NotificationModule;
    readonly categoryLabel: string;
    readonly title: string;
    readonly altText?: string;
    readonly contents: LineFlexComponent[];
    readonly actionLabel: string;
    readonly actionUrl: string;
    readonly accentColor: string;
}

/** Provider presentation only: no audience, routing, event or delivery decisions. */
export function buildNotificationFlex(data: NotificationFlexData): LineFlexMessage {
    return {
        type: "flex",
        altText: notificationAltText(data.module, data.altText ?? data.title),
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                backgroundColor: data.accentColor,
                contents: [{
                    type: "text",
                    text: `NHFapp | ${NOTIFICATION_MODULES[data.module].label} · ${data.categoryLabel}`,
                    color: "#FFFFFF",
                    size: "sm",
                    weight: "bold",
                    wrap: true,
                }],
            },
            body: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                spacing: "sm",
                contents: [
                    {
                        type: "text",
                        text: data.title,
                        size: "lg",
                        weight: "bold",
                        color: "#111827",
                        wrap: true,
                    },
                    ...data.contents,
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                spacing: "sm",
                contents: [{
                    type: "button",
                    style: "primary",
                    height: "sm",
                    color: data.accentColor,
                    action: {
                        type: "uri",
                        label: data.actionLabel,
                        uri: data.actionUrl,
                    },
                }],
            },
        },
    };
}

export function notificationFlexText(text: string): LineFlexComponent {
    return { type: "text", text, size: "sm", color: "#4B5563", wrap: true };
}
