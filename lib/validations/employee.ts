import { z } from "zod";

const PHONE_ERROR_MESSAGE =
    "กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เช่น 0889999999 หรือ 088-9999999)";

function normalizePhoneNumber(value: string): string {
    return value.replace(/\D/g, "");
}

function toPhoneStoragePattern(value: string): string {
    return `${value.slice(0, 3)}-${value.slice(3)}`;
}

function isValidThaiPhone(value: string): boolean {
    if (value === "") {
        return true;
    }
    return normalizePhoneNumber(value).length === 10;
}

const emptyToUndefined = (value: unknown): unknown =>
    value === "" || value === null ? undefined : value;

const employeePhoneSchema = z
    .string()
    .trim()
    .max(20, PHONE_ERROR_MESSAGE)
    .refine(isValidThaiPhone, PHONE_ERROR_MESSAGE)
    .nullish()
    .transform((val) => {
        if (!val) {
            return null;
        }
        const normalized = normalizePhoneNumber(val);
        if (normalized.length === 0) {
            return null;
        }
        return toPhoneStoragePattern(normalized);
    });

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
    phone: employeePhoneSchema,
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
    phone: employeePhoneSchema,
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
    managerId: z.number().int().positive().nullable().optional(),
});

export const employeeFiltersSchema = z.object({
    search: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(200).optional(),
    ),
    status: z.preprocess(
        emptyToUndefined,
        z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "all"]).optional(),
    ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Inferred types for use in API routes
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFiltersInput = z.infer<typeof employeeFiltersSchema>;
