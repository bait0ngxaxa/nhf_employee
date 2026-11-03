import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexStatus,
    notificationFlexText,
} from "@/lib/line/notification-flex";
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
            notificationFlexText(data.taskTitle, { weight: "bold", size: "md" }),
            {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "sm",
                contents: [
                    notificationFlexDetail("หน่วยงาน", data.unitName),
                    notificationFlexDetail("หมวดหมู่", data.categoryName),
                    notificationFlexDetail("ครบกำหนด", data.dueDateLabel),
                    notificationFlexStatus(data.timingLabel, "warning"),
                ],
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.task,
        actionUrl: data.actionUrl,
        status: "warning",
    });
}
