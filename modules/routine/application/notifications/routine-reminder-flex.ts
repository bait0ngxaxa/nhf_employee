import { buildNotificationFlex } from "@/lib/line/notification-flex";
import {
    NOTIFICATION_ACTIONS,
    NOTIFICATION_COLORS,
    NOTIFICATION_STATUS_COLORS,
} from "@/shared/notifications/presentation";
import type { LineFlexMessage } from "@/types/api";

export interface RoutineReminderFlexMessageData {
    taskTitle: string;
    unitName: string;
    categoryName: string;
    dueDateLabel: string;
    timingLabel: string;
    actionUrl: string;
}

export function generateRoutineReminderFlexMessage(
    data: RoutineReminderFlexMessageData,
): LineFlexMessage {
    return buildNotificationFlex({
        module: "Routine",
        categoryLabel: "งานตามกำหนด",
        title: "งานใกล้ถึงกำหนด",
        altText: `งานใกล้ถึงกำหนด: ${data.taskTitle}`,
        contents: [
            {
                type: "text",
                text: data.taskTitle,
                weight: "bold",
                size: "md",
                wrap: true,
            },
            {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "sm",
                contents: [
                    {
                        type: "text",
                        text: `หน่วยงาน: ${data.unitName}`,
                        color: NOTIFICATION_COLORS.muted,
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: `หมวดหมู่: ${data.categoryName}`,
                        color: NOTIFICATION_COLORS.muted,
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: `ครบกำหนด: ${data.dueDateLabel}`,
                        color: NOTIFICATION_COLORS.heading,
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: data.timingLabel,
                        color: NOTIFICATION_STATUS_COLORS.warning,
                        size: "sm",
                        weight: "bold",
                        wrap: true,
                    },
                ],
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.task,
        actionUrl: data.actionUrl,
        status: "warning",
    });
}
