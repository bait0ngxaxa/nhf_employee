import { z } from "zod";

const PHONE_ERROR_MESSAGE =
    "กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก เช่น 0889999999 หรือ 088-9999999)";

function normalizePhoneNumber(value: string): string {
    return value.replace(/\D/g, "");
}

const employeePhoneSchema = z.string().trim().max(20, PHONE_ERROR_MESSAGE)
    .refine((value) => value === "" || normalizePhoneNumber(value).length === 10, PHONE_ERROR_MESSAGE)
    .nullish()
    .transform((value) => {
        if (!value) return null;
        const normalized = normalizePhoneNumber(value);
        return normalized.length === 0 ? null : `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
    });

const emptyToUndefined = (value: unknown): unknown =>
    value === "" || value === null ? undefined : value;

export const createEmployeeSchema = z.object({
    firstName: z.string({ message: "กรุณากรอกชื่อ" }).min(1, "กรุณากรอกชื่อ").max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร").trim(),
    lastName: z.string({ message: "กรุณากรอกนามสกุล" }).min(1, "กรุณากรอกนามสกุล").max(100, "นามสกุลต้องไม่เกิน 100 ตัวอักษร").trim(),
    nickname: z.string().max(50, "ชื่อเล่นต้องไม่เกิน 50 ตัวอักษร").trim().nullish().transform((value) => value || null),
    email: z.string({ message: "กรุณากรอกอีเมล" }).min(1, "กรุณากรอกอีเมล").email("รูปแบบอีเมลไม่ถูกต้อง").toLowerCase().trim(),
    phone: employeePhoneSchema,
    position: z.string({ message: "กรุณากรอกตำแหน่ง" }).min(1, "กรุณากรอกตำแหน่ง").max(200, "ตำแหน่งต้องไม่เกิน 200 ตัวอักษร").trim(),
    affiliation: z.string().max(200, "สังกัดต้องไม่เกิน 200 ตัวอักษร").trim().nullish().transform((value) => value || null),
    departmentId: z.union([z.string(), z.number()])
        .transform((value) => typeof value === "string" ? parseInt(value, 10) : value)
        .refine((value) => !Number.isNaN(value) && value > 0, { message: "กรุณาเลือกแผนก" }),
});

export const updateEmployeeSchema = z.object({
    firstName: z.string().min(1, "กรุณากรอกชื่อ").max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร").trim().optional(),
    lastName: z.string().min(1, "กรุณากรอกนามสกุล").max(100, "นามสกุลต้องไม่เกิน 100 ตัวอักษร").trim().optional(),
    nickname: z.string().max(50, "ชื่อเล่นต้องไม่เกิน 50 ตัวอักษร").trim().nullish().transform((value) => value || null),
    email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").toLowerCase().trim().optional().or(z.literal("")).or(z.literal("-")),
    phone: employeePhoneSchema,
    position: z.string().min(1, "กรุณากรอกตำแหน่ง").max(200, "ตำแหน่งต้องไม่เกิน 200 ตัวอักษร").trim().optional(),
    affiliation: z.string().max(200, "สังกัดต้องไม่เกิน 200 ตัวอักษร").trim().nullish().transform((value) => value || null),
    departmentId: z.union([z.string(), z.number()])
        .transform((value) => typeof value === "string" ? parseInt(value, 10) : value)
        .refine((value) => !Number.isNaN(value) && value > 0, { message: "กรุณาเลือกแผนก" }).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

export const employeeFiltersSchema = z.object({
    search: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    status: z.preprocess(emptyToUndefined, z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "all"]).optional()),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFiltersInput = z.infer<typeof employeeFiltersSchema>;
