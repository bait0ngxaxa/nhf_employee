import { buildNotificationFlex } from "@/lib/line/notification-flex";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";
import type { LineFlexMessage } from "@/types/api";

export interface RoutineContractExpiryFlexMessageData {
    taskTitle: string;
    unitName: string;
    categoryName: string;
    contractEndDateLabel: string;
    actionUrl: string;
}

export function generateRoutineContractExpiryFlexMessage(
    data: RoutineContractExpiryFlexMessageData,
): LineFlexMessage {
    return buildNotificationFlex({
        module: "Routine",
        categoryLabel: "สัญญา",
        title: "สัญญาใกล้สิ้นสุด",
        altText: `สัญญาใกล้สิ้นสุด: ${data.taskTitle}`,
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
                        text: `สิ้นสุดสัญญา: ${data.contractEndDateLabel}`,
                        color: "#111827",
                        size: "sm",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: "เหลือเวลาประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการที่เกี่ยวข้อง",
                        color: "#9A3412",
                        size: "sm",
                        weight: "bold",
                        wrap: true,
                    },
                ],
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.task,
        actionUrl: data.actionUrl,
        accentColor: "#C2410C",
    });
}
