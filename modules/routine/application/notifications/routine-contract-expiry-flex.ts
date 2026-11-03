import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexStatus,
    notificationFlexText,
} from "@/lib/line/notification-flex";
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
            notificationFlexText(data.taskTitle, { weight: "bold", size: "md" }),
            {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "sm",
                contents: [
                    notificationFlexDetail("หน่วยงาน", data.unitName),
                    notificationFlexDetail("หมวดหมู่", data.categoryName),
                    notificationFlexDetail("สิ้นสุดสัญญา", data.contractEndDateLabel),
                    notificationFlexStatus(
                        "เหลือเวลาประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการที่เกี่ยวข้อง",
                        "warning",
                    ),
                ],
            },
        ],
        actionLabel: NOTIFICATION_ACTIONS.task,
        actionUrl: data.actionUrl,
        status: "warning",
    });
}
