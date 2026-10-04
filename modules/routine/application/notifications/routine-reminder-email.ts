import type { RoutineReminderEmailData } from "./notification-types";
import { generateNotificationEmailHTML } from "@/lib/email/templates/notification";
import { NOTIFICATION_ACTIONS, NOTIFICATION_FOOTER } from "@/shared/notifications/presentation";

function formatThaiDueDate(dueDate: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(`${dueDate}T00:00:00.000+07:00`));
}

function getTimingText(daysBefore: number): string {
    return daysBefore === 0
        ? "ครบกำหนดวันนี้"
        : `เหลือเวลา ${daysBefore} วัน`;
}

export function generateRoutineReminderEmailHTML(
    data: RoutineReminderEmailData,
): string {
    return generateNotificationEmailHTML({ module: "Routine", categoryLabel: "งานตามกำหนด",
        title: "งานใกล้ถึงกำหนด", intro: `เรียน ${data.recipientName}\nกรุณาตรวจสอบงาน Routine ตามกำหนดด้านล่าง`,
        details: [
            { label: "ชื่องาน", value: data.taskTitle }, { label: "หน่วยงาน", value: data.unitName },
            { label: "หมวดหมู่", value: data.categoryName }, { label: "วันครบกำหนด", value: formatThaiDueDate(data.dueDate) },
            { label: "สถานะกำหนด", value: getTimingText(data.daysBefore) },
        ], actionLabel: NOTIFICATION_ACTIONS.task, actionUrl: data.actionUrl });
}

export function generateRoutineReminderEmailText(
    data: RoutineReminderEmailData,
): string {
    return `เรียน ${data.recipientName},

งานใกล้ถึงกำหนด
ชื่องาน: ${data.taskTitle}
หน่วยงาน: ${data.unitName}
หมวดหมู่: ${data.categoryName}
วันครบกำหนด: ${formatThaiDueDate(data.dueDate)}
${getTimingText(data.daysBefore)}

${NOTIFICATION_ACTIONS.task}: ${data.actionUrl}\n\n${NOTIFICATION_FOOTER}`;
}
