import { generateNotificationEmailHTML } from "./notification";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";

export function generatePasswordResetEmailHTML(resetUrl: string, userName: string): string {
    return generateNotificationEmailHTML({
        module: "Account", categoryLabel: "บัญชีผู้ใช้", title: "คำขอรีเซ็ตรหัสผ่าน",
        intro: `เรียน ${userName}\nระบบได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กรุณาตั้งรหัสผ่านใหม่ผ่านลิงก์ด้านล่าง`,
        preheader: "คำขอรีเซ็ตรหัสผ่าน NHFapp · ลิงก์หมดอายุภายใน 1 ชั่วโมง",
        details: [
            { label: "อายุลิงก์", value: "ลิงก์นี้จะหมดอายุภายใน 1 ชั่วโมง" },
            { label: "หากคุณไม่ได้ส่งคำขอ", value: "กรุณาเพิกเฉยอีเมลนี้ รหัสผ่านของคุณจะไม่ถูกเปลี่ยนแปลง" },
        ], actionLabel: NOTIFICATION_ACTIONS.passwordReset, actionUrl: resetUrl,
    });
}
