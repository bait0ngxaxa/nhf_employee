/** Presentation identity only; event meaning and audiences remain domain-owned. */
export const NOTIFICATION_MODULES = {
    IT: { label: "IT", sender: "NHFapp | ระบบ IT" },
    Leave: { label: "วันลา", sender: "NHFapp | ระบบวันลา" },
    Routine: { label: "Routine", sender: "NHFapp | ระบบ Routine" },
    Stock: { label: "Stock", sender: "NHFapp | ระบบ Stock" },
    Account: { label: "บัญชีผู้ใช้", sender: "NHFapp | บัญชีผู้ใช้" },
} as const;

export type NotificationModule = keyof typeof NOTIFICATION_MODULES;

export const NOTIFICATION_FOOTER =
    "ระบบ NHFapp ส่งอีเมลฉบับนี้โดยอัตโนมัติ กรุณาอย่าตอบกลับ";

export const NOTIFICATION_ACTIONS = {
    ticket: "เปิด Ticket",
    review: "ตรวจสอบคำขอ",
    details: "เปิดรายละเอียด",
    task: "เปิดดูงาน",
    inventory: "เปิดคลังวัสดุ",
    passwordReset: "ตั้งรหัสผ่านใหม่",
} as const;

export function notificationSubject(module: NotificationModule, title: string): string {
    return `[NHFapp][${module}] ${title.replace(/[\r\n]+/g, " ").trim()}`;
}

export function notificationAltText(module: NotificationModule, title: string): string {
    return `${NOTIFICATION_MODULES[module].label}: ${title.replace(/[\r\n]+/g, " ").trim()}`.slice(0, 400);
}
