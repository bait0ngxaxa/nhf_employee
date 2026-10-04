import { buildNotificationFlex } from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
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
                        color: "#4B5563",
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: `หมวดหมู่: ${data.categoryName}`,
                        color: "#4B5563",
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: `ครบกำหนด: ${data.dueDateLabel}`,
                        color: "#111827",
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: data.timingLabel,
                        color: "#1D4ED8",
                        size: "sm",
                        weight: "bold",
                        wrap: true,
                    },
                ],
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.task,
        actionUrl: data.actionUrl,
        accentColor: "#2563EB",
    });
}
