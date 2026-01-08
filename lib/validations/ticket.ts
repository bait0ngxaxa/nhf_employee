import { z } from "zod";

export const TICKET_CATEGORIES = [
    "HARDWARE",
    "SOFTWARE",
    "NETWORK",
    "EMAIL",
    "OTHER",
] as const;

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const TICKET_STATUSES = [
    "OPEN",
    "IN_PROGRESS",
    "PENDING",
    "RESOLVED",
    "CLOSED",
] as const;

export const createTicketSchema = z.object({
    title: z
        .string({ message: "กรุณากรอกหัวข้อ" })
        .min(1, "กรุณากรอกหัวข้อ")
        .max(200, "หัวข้อต้องไม่เกิน 200 ตัวอักษร")
        .trim(),
    description: z
        .string({ message: "กรุณากรอกรายละเอียด" })
        .min(1, "กรุณากรอกรายละเอียด")
        .max(5000, "รายละเอียดต้องไม่เกิน 5000 ตัวอักษร")
        .trim(),
    category: z.enum(TICKET_CATEGORIES, {
        message: "กรุณาเลือกประเภทปัญหา",
    }),
    priority: z
        .enum(TICKET_PRIORITIES, {
            message: "ระดับความเร่งด่วนไม่ถูกต้อง",
        })
        .default("MEDIUM"),
});

export const updateTicketSchema = z.object({
    title: z
        .string()
        .min(1, "กรุณากรอกหัวข้อ")
        .max(200, "หัวข้อต้องไม่เกิน 200 ตัวอักษร")
        .trim()
        .optional(),
    description: z
        .string()
        .min(1, "กรุณากรอกรายละเอียด")
        .max(5000, "รายละเอียดต้องไม่เกิน 5000 ตัวอักษร")
        .trim()
        .optional(),
    category: z
        .enum(TICKET_CATEGORIES, {
            message: "ประเภทปัญหาไม่ถูกต้อง",
        })
        .optional(),
    priority: z
        .enum(TICKET_PRIORITIES, {
            message: "ระดับความเร่งด่วนไม่ถูกต้อง",
        })
        .optional(),
    status: z
        .enum(TICKET_STATUSES, {
            message: "สถานะไม่ถูกต้อง",
        })
        .optional(),
    resolution: z
        .string()
        .max(5000, "การแก้ไขต้องไม่เกิน 5000 ตัวอักษร")
        .trim()
        .nullish(),
    assignedToId: z
        .union([z.string(), z.number()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .refine((val) => !isNaN(val) && val > 0, {
            message: "ผู้รับผิดชอบไม่ถูกต้อง",
        })
        .nullish(),
});

// Inferred types for use in API routes
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
