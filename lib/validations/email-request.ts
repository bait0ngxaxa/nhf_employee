import { z } from "zod";
import { SHARED_DRIVE_OPTIONS } from "@/constants/email-request";

const PHONE_ERROR_MESSAGE =
    "กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เช่น 0889999999 หรือ 088-9999999)";

function normalizePhoneNumber(value: string): string {
    return value.replace(/\D/g, "");
}

function toPhoneStoragePattern(value: string): string {
    return `${value.slice(0, 3)}-${value.slice(3)}`;
}

/**
 * Schema for creating a new email request
 */
export const emailRequestSchema = z.object({
    thaiName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล (ไทย)"),
    englishName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล (อังกฤษ)"),
    phone: z
        .string()
        .trim()
        .max(20, PHONE_ERROR_MESSAGE)
        .refine(
            (value) => normalizePhoneNumber(value).length === 10,
            PHONE_ERROR_MESSAGE,
        )
        .transform((value) => toPhoneStoragePattern(normalizePhoneNumber(value))),
    nickname: z.string().min(1, "กรุณากรอกชื่อเล่น"),
    position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
    department: z.string().min(1, "กรุณากรอกสังกัด"),
    replyEmail: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
    needsDocumentSystem: z.boolean().default(false),
    sharedDriveAccess: z
        .array(z.enum(SHARED_DRIVE_OPTIONS))
        .max(SHARED_DRIVE_OPTIONS.length)
        .refine(
            (value) => new Set(value).size === value.length,
            "ไม่ควรเลือก Shared Drive ซ้ำ",
        )
        .default([]),
});

/**
 * Type inference from schema
 */
export type EmailRequestInput = z.infer<typeof emailRequestSchema>;
