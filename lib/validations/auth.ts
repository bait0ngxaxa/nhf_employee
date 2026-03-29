import { z } from "zod";

export const signupSchema = z
    .object({
        email: z
            .string()
            .min(1, "กรุณากรอกอีเมล")
            .email("รูปแบบอีเมลไม่ถูกต้อง")
            .transform((value) => value.trim().toLowerCase())
            .refine(
                (value) => value.endsWith("@thainhf.org"),
                "กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น",
            ),
        password: z
            .string()
            .min(6, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"),
        confirmPassword: z
            .string()
            .min(1, "กรุณายืนยันรหัสผ่าน"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "รหัสผ่านไม่ตรงกัน",
        path: ["confirmPassword"],
    });

export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, "กรุณากรอกอีเมล")
        .email("รูปแบบอีเมลไม่ถูกต้อง"),
});

export const resetPasswordSchema = z
    .object({
        token: z.string().min(1, "Token ไม่ถูกต้อง"),
        password: z
            .string()
            .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                "รหัสผ่านต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลขอย่างน้อยอย่างละ 1 ตัว",
            ),
        confirmPassword: z
            .string()
            .min(1, "กรุณายืนยันรหัสผ่าน"),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "รหัสผ่านไม่ตรงกัน",
        path: ["confirmPassword"],
    });

export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
