import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";

export const TICKET_CATEGORIES = Object.values(TicketCategory);
export const TICKET_PRIORITIES = Object.values(TicketPriority);
export const TICKET_STATUSES = Object.values(TicketStatus);

const emptyToUndefined = (value: unknown): unknown =>
    value === "" || value === null ? undefined : value;

export const ticketFiltersSchema = z.object({
    status: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(TicketStatus).optional(),
    ),
    category: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(TicketCategory).optional(),
    ),
    priority: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(TicketPriority).optional(),
    ),
    search: z.preprocess(
        emptyToUndefined,
        z.string().trim().max(200).optional(),
    ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

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
    category: z.nativeEnum(TicketCategory, {
        message: "กรุณาเลือกประเภทปัญหา",
    }),
    priority: z
        .nativeEnum(TicketPriority, {
            message: "ระดับความเร่งด่วนไม่ถูกต้อง",
        })
        .default(TicketPriority.MEDIUM),
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
        .nativeEnum(TicketCategory, {
            message: "ประเภทปัญหาไม่ถูกต้อง",
        })
        .optional(),
    priority: z
        .nativeEnum(TicketPriority, {
            message: "ระดับความเร่งด่วนไม่ถูกต้อง",
        })
        .optional(),
    status: z
        .nativeEnum(TicketStatus, {
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
export type TicketFiltersInput = z.infer<typeof ticketFiltersSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
