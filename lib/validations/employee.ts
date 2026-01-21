import { z } from "zod";

export const createEmployeeSchema = z.object({
    firstName: z
        .string({ message: "กรุณากรอกชื่อ" })
        .min(1, "กรุณากรอกชื่อ")
        .max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร")
        .trim(),
    lastName: z
        .string({ message: "กรุณากรอกนามสกุล" })
        .min(1, "กรุณากรอกนามสกุล")
        .max(100, "นามสกุลต้องไม่เกิน 100 ตัวอักษร")
        .trim(),
    nickname: z
        .string()
        .max(50, "ชื่อเล่นต้องไม่เกิน 50 ตัวอักษร")
        .trim()
        .nullish()
        .transform((val) => val || null),
    email: z
        .string({ message: "กรุณากรอกอีเมล" })
        .min(1, "กรุณากรอกอีเมล")
        .email("รูปแบบอีเมลไม่ถูกต้อง")
        .toLowerCase()
        .trim(),
    phone: z
        .string()
        .max(10, "เบอร์โทรต้องไม่เกิน 10 ตัวอักษร")
        .trim()
        .nullish()
        .transform((val) => val || null),
    position: z
        .string({ message: "กรุณากรอกตำแหน่ง" })
        .min(1, "กรุณากรอกตำแหน่ง")
        .max(200, "ตำแหน่งต้องไม่เกิน 200 ตัวอักษร")
        .trim(),
    affiliation: z
        .string()
        .max(200, "สังกัดต้องไม่เกิน 200 ตัวอักษร")
        .trim()
        .nullish()
        .transform((val) => val || null),
    departmentId: z
        .union([z.string(), z.number()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .refine((val) => !isNaN(val) && val > 0, {
            message: "กรุณาเลือกแผนก",
        }),
});

export const updateEmployeeSchema = z.object({
    firstName: z
        .string()
        .min(1, "กรุณากรอกชื่อ")
        .max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร")
        .trim()
        .optional(),
    lastName: z
        .string()
        .min(1, "กรุณากรอกนามสกุล")
        .max(100, "นามสกุลต้องไม่เกิน 100 ตัวอักษร")
        .trim()
        .optional(),
    nickname: z
        .string()
        .max(50, "ชื่อเล่นต้องไม่เกิน 50 ตัวอักษร")
        .trim()
        .nullish()
        .transform((val) => val || null),
    email: z
        .string()
        .email("รูปแบบอีเมลไม่ถูกต้อง")
        .toLowerCase()
        .trim()
        .optional()
        .or(z.literal(""))
        .or(z.literal("-")),
    phone: z
        .string()
        .max(20, "เบอร์โทรต้องไม่เกิน 20 ตัวอักษร")
        .trim()
        .nullish()
        .transform((val) => val || null),
    position: z
        .string()
        .min(1, "กรุณากรอกตำแหน่ง")
        .max(200, "ตำแหน่งต้องไม่เกิน 200 ตัวอักษร")
        .trim()
        .optional(),
    affiliation: z
        .string()
        .max(200, "สังกัดต้องไม่เกิน 200 ตัวอักษร")
        .trim()
        .nullish()
        .transform((val) => val || null),
    departmentId: z
        .union([z.string(), z.number()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .refine((val) => !isNaN(val) && val > 0, {
            message: "กรุณาเลือกแผนก",
        })
        .optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

// Inferred types for use in API routes
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
