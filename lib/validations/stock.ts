import { StockRequestStatus, StockTxType } from "@prisma/client";
import { z } from "zod";

export const createCategorySchema = z.object({
    name: z
        .string({ message: "กรุณากรอกชื่อหมวดหมู่" })
        .min(1, "กรุณากรอกชื่อหมวดหมู่")
        .max(100, "ชื่อหมวดหมู่ต้องไม่เกิน 100 ตัวอักษร")
        .trim(),
    description: z
        .string()
        .max(500, "คำอธิบายต้องไม่เกิน 500 ตัวอักษร")
        .trim()
        .nullish(),
});

export const createItemSchema = z.object({
    name: z
        .string({ message: "กรุณากรอกชื่อวัสดุ" })
        .min(1, "กรุณากรอกชื่อวัสดุ")
        .max(200, "ชื่อวัสดุต้องไม่เกิน 200 ตัวอักษร")
        .trim(),
    sku: z
        .string()
        .max(50, "รหัส SKU ต้องไม่เกิน 50 ตัวอักษร")
        .trim()
        .optional(),
    unit: z
        .string({ message: "กรุณากรอกหน่วย" })
        .min(1, "กรุณากรอกหน่วย")
        .max(50, "หน่วยต้องไม่เกิน 50 ตัวอักษร")
        .trim(),
    quantity: z.coerce
        .number()
        .int("จำนวนต้องเป็นจำนวนเต็ม")
        .min(1, "จำนวนต้องมากกว่า 0")
        .default(1),
    minStock: z.coerce
        .number()
        .int("จุดสั่งซื้อต้องเป็นจำนวนเต็ม")
        .min(1, "จุดสั่งซื้อต้องมากกว่า 0")
        .default(1),
    categoryId: z.coerce
        .number()
        .int()
        .positive("กรุณาเลือกหมวดหมู่")
        .optional(),
});

export const updateItemSchema = z.object({
    name: z.string().min(1).max(200).trim().optional(),
    sku: z.string().min(1).max(50).trim().optional(),
    unit: z.string().min(1).max(50).trim().optional(),
    minStock: z.coerce.number().int().min(1).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    isActive: z.boolean().optional(),
});

export const adjustStockSchema = z.object({
    type: z.literal(StockTxType.IN, {
        message: "รองรับเฉพาะการรับเข้า (IN)",
    }),
    quantity: z.coerce
        .number()
        .int("จำนวนต้องเป็นจำนวนเต็ม")
        .refine((n) => n !== 0, "จำนวนต้องไม่เป็น 0"),
    minStock: z.coerce
        .number()
        .int("จุดสั่งซื้อต้องเป็นจำนวนเต็ม")
        .min(1, "จุดสั่งซื้อต้องมากกว่า 0"),
}).superRefine((data, ctx) => {
    if (data.type === StockTxType.IN && data.quantity < 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["quantity"],
            message: "รับเข้า (IN) ต้องเป็นจำนวนบวก",
        });
    }
});

const requestItemSchema = z.object({
    itemId: z.coerce.number().int().positive("กรุณาเลือกรายการวัสดุ"),
    quantity: z.coerce
        .number()
        .int("จำนวนต้องเป็นจำนวนเต็ม")
        .positive("จำนวนต้องมากกว่า 0"),
});

export const createRequestSchema = z
    .object({
        items: z
            .array(requestItemSchema)
            .min(1, "กรุณาเลือกอย่างน้อย 1 รายการ")
            .max(20, "เบิกได้สูงสุด 20 รายการต่อครั้ง"),
        note: z.string().max(1000).trim().nullish(),
    })
    .superRefine((data, ctx) => {
        const seen = new Set<number>();
        for (let i = 0; i < data.items.length; i += 1) {
            const item = data.items[i];
            if (seen.has(item.itemId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["items", i, "itemId"],
                    message: "ห้ามเลือกรายการวัสดุซ้ำ",
                });
                return;
            }
            seen.add(item.itemId);
        }
    });

export const reviewRequestSchema = z.object({
    action: z.enum(["approve", "reject"], {
        message: "action ต้องเป็น approve หรือ reject",
    }),
    rejectReason: z.string().max(500).trim().nullish(),
});

const emptyToUndefined = (value: unknown): unknown =>
    value === "" || value === null ? undefined : value;

export const stockItemsFilterSchema = z.object({
    categoryId: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().positive().optional(),
    ),
    search: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
    activeOnly: z.preprocess(
        emptyToUndefined,
        z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .optional(),
    ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockRequestsFilterSchema = z.object({
    status: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(StockRequestStatus).optional(),
    ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
export type StockItemsFilter = z.infer<typeof stockItemsFilterSchema>;
export type StockRequestsFilter = z.infer<typeof stockRequestsFilterSchema>;
