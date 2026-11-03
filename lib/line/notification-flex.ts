import type { LineFlexComponent, LineFlexMessage } from "@/types/api";
import {
    NOTIFICATION_COLORS,
    NOTIFICATION_MODULES,
    NOTIFICATION_STATUS_COLORS,
    notificationAltText,
    type NotificationModule,
    type NotificationStatus,
} from "@/shared/notifications/presentation";

interface NotificationFlexData {
    readonly module: NotificationModule;
    readonly categoryLabel: string;
    readonly title: string;
    readonly altText?: string;
    readonly contents: LineFlexComponent[];
    readonly actionLabel: string;
    readonly actionUrl: string;
    readonly status?: NotificationStatus;
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
                paddingAll: "16px",
                backgroundColor: NOTIFICATION_COLORS.brandPrimary,
                contents: [{
                    type: "text",
                    text: `NHFapp | ${NOTIFICATION_MODULES[data.module].label} · ${data.categoryLabel}`,
                    color: NOTIFICATION_COLORS.surface,
                    size: "sm",
                    weight: "bold",
                    wrap: true,
                }],
            },
            body: {
                type: "box",
                layout: "vertical",
                paddingAll: "16px",
                spacing: "md",
                contents: [
                    {
                        type: "text",
                        text: data.title,
                        size: "lg",
                        weight: "bold",
                        color: data.status
                            ? NOTIFICATION_STATUS_COLORS[data.status]
                            : NOTIFICATION_COLORS.heading,
                        wrap: true,
                    },
                    ...data.contents,
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                paddingAll: "12px",
                spacing: "sm",
                contents: [{
                    type: "button",
                    style: "primary",
                    height: "sm",
                    color: NOTIFICATION_COLORS.brandAction,
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
    return { type: "text", text, size: "sm", color: NOTIFICATION_COLORS.body, wrap: true };
}

export function notificationFlexDetail(label: string, value: string): LineFlexComponent {
    return {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
            { type: "text", text: `${label}:`, size: "xs", color: NOTIFICATION_COLORS.muted, wrap: true },
            { type: "text", text: value, size: "sm", color: NOTIFICATION_COLORS.body, wrap: true },
        ],
    };
}

export function notificationFlexStatus(
    text: string,
    status: NotificationStatus,
): LineFlexComponent {
    return {
        type: "text",
        text,
        size: "sm",
        weight: "bold",
        color: NOTIFICATION_STATUS_COLORS[status],
        wrap: true,
    };
}
