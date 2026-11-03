import type { LineFlexBox, LineFlexComponent, LineFlexMessage, LineFlexText } from "@/types/api";
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

export type NotificationFlexTextOptions = Pick<
    Partial<LineFlexText>,
    "color" | "flex" | "margin" | "size" | "weight"
>;

export type NotificationFlexDetailLayout = "compact" | "stacked";

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
                    scaling: true,
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
                        scaling: true,
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
                    scaling: true,
                }],
            },
        },
    };
}

export function notificationFlexText(
    text: string,
    options: NotificationFlexTextOptions = {},
): LineFlexText {
    return {
        ...options,
        type: "text",
        text,
        size: options.size ?? "sm",
        color: options.color ?? NOTIFICATION_COLORS.body,
        wrap: true,
        scaling: true,
    };
}

export function notificationFlexDetail(
    label: string,
    value: string,
    layout: NotificationFlexDetailLayout = "compact",
): LineFlexBox {
    const compact = layout === "compact";
    return {
        type: "box",
        layout: compact ? "horizontal" : "vertical",
        spacing: compact ? "sm" : "xs",
        contents: [
            notificationFlexText(`${label}:`, {
                size: "xs",
                color: NOTIFICATION_COLORS.muted,
                ...(compact ? { flex: 1 } : {}),
            }),
            notificationFlexText(value, compact ? { flex: 2 } : {}),
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
        scaling: true,
    };
}
