import type { RoutineContractExpiryEmailData } from "./notification-types";
import { generateNotificationEmailHTML } from "@/lib/email/templates/notification";
import { NOTIFICATION_ACTIONS, NOTIFICATION_FOOTER } from "@/shared/notifications/presentation";

function formatThaiContractEndDate(contractEndDate: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(`${contractEndDate}T00:00:00.000+07:00`));
}

export function generateRoutineContractExpiryEmailHTML(
    data: RoutineContractExpiryEmailData,
): string {
    return generateNotificationEmailHTML({ module: "Routine", categoryLabel: "สัญญา",
        title: "สัญญาใกล้สิ้นสุด", intro: `เรียน ${data.recipientName}\nสัญญาของงาน Routine จะสิ้นสุดในอีกประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการที่เกี่ยวข้อง`,
        details: [
            { label: "ชื่องาน", value: data.taskTitle }, { label: "หน่วยงาน", value: data.unitName },
            { label: "หมวดหมู่", value: data.categoryName }, { label: "วันสิ้นสุดสัญญา", value: formatThaiContractEndDate(data.contractEndDate) },
        ], actionLabel: NOTIFICATION_ACTIONS.task, actionUrl: data.actionUrl });
}

export function generateRoutineContractExpiryEmailText(
    data: RoutineContractExpiryEmailData,
): string {
    return `เรียน ${data.recipientName},

สัญญาใกล้สิ้นสุด
ชื่องาน: ${data.taskTitle}
หน่วยงาน: ${data.unitName}
หมวดหมู่: ${data.categoryName}
วันสิ้นสุดสัญญา: ${formatThaiContractEndDate(data.contractEndDate)}

สัญญาจะสิ้นสุดในอีกประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการต่อสัญญาหรือดำเนินการที่เกี่ยวข้อง

${NOTIFICATION_ACTIONS.task}: ${data.actionUrl}\n\n${NOTIFICATION_FOOTER}`;
}
