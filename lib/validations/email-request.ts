import { z } from "zod";

/**
 * Schema for creating a new email request
 */
export const emailRequestSchema = z.object({
    thaiName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล (ไทย)"),
    englishName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล (อังกฤษ)"),
    phone: z
        .string()
        .regex(/^[0-9\-\s\+\(\)]{10,15}$/, "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง"),
    nickname: z.string().min(1, "กรุณากรอกชื่อเล่น"),
    position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
    department: z.string().min(1, "กรุณากรอกสังกัด"),
    replyEmail: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
});

/**
 * Type inference from schema
 */
export type EmailRequestInput = z.infer<typeof emailRequestSchema>;
