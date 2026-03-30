import { StockRequestStatus, StockTxType } from "@prisma/client";
import { z } from "zod";

function isValidImageUrl(value: string): boolean {
    if (value.startsWith("/api/uploads/")) {
        return true;
    }

    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

const imageUrlSchema = z
    .string()
    .max(2000)
    .trim()
    .refine(isValidImageUrl, "รูปภาพต้องเป็นลิงก์ที่ถูกต้อง");

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

const variantAttributeSchema = z.object({
    name: z
        .string({ message: "กรุณากรอกชื่อคุณสมบัติ" })
        .min(1, "กรุณากรอกชื่อคุณสมบัติ")
        .max(100, "ชื่อคุณสมบัติต้องไม่เกิน 100 ตัวอักษร")
        .trim(),
    value: z
        .string({ message: "กรุณากรอกค่าคุณสมบัติ" })
        .min(1, "กรุณากรอกค่าคุณสมบัติ")
        .max(100, "ค่าคุณสมบัติต้องไม่เกิน 100 ตัวอักษร")
        .trim(),
});

const variantSchema = z
    .object({
        sku: z
            .string()
            .max(50, "รหัส SKU ของรายการย่อยต้องไม่เกิน 50 ตัวอักษร")
            .trim()
            .optional(),
        unit: z
            .string({ message: "กรุณากรอกหน่วยของรายการย่อย" })
            .min(1, "กรุณากรอกหน่วยของรายการย่อย")
            .max(50, "หน่วยของรายการย่อยต้องไม่เกิน 50 ตัวอักษร")
            .trim(),
        quantity: z.coerce
            .number()
            .int("จำนวนของรายการย่อยต้องเป็นจำนวนเต็ม")
            .min(1, "จำนวนของรายการย่อยต้องมากกว่า 0"),
        minStock: z.coerce
            .number()
            .int("จุดสั่งซื้อของรายการย่อยต้องเป็นจำนวนเต็ม")
            .min(1, "จุดสั่งซื้อของรายการย่อยต้องมากกว่า 0"),
        imageUrl: imageUrlSchema.nullish(),
        attributes: z
            .array(variantAttributeSchema)
            .max(5, "ใส่คุณสมบัติได้สูงสุด 5 รายการ")
            .default([]),
    })
    .superRefine((variant, ctx) => {
        const seen = new Set<string>();

        for (let index = 0; index < variant.attributes.length; index += 1) {
            const attribute = variant.attributes[index];
            const key = attribute.name.toLowerCase();

            if (seen.has(key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["attributes", index, "name"],
                    message: "ชื่อคุณสมบัติซ้ำกันในรายการย่อยเดียวกัน",
                });
                return;
            }

            seen.add(key);
        }
    });

export const createItemSchema = z
    .object({
        name: z
            .string({ message: "กรุณากรอกชื่อวัสดุ" })
            .min(1, "กรุณากรอกชื่อวัสดุ")
            .max(200, "ชื่อวัสดุต้องไม่เกิน 200 ตัวอักษร")
            .trim(),
        description: z.string().max(2000).trim().nullish(),
        imageUrl: imageUrlSchema.nullish(),
        sku: z
            .string()
            .max(50, "รหัส SKU ต้องไม่เกิน 50 ตัวอักษร")
            .trim()
            .optional(),
        unit: z.string().min(1).max(50).trim().optional(),
        quantity: z.coerce.number().int().min(1).optional(),
        minStock: z.coerce.number().int().min(1).optional(),
        categoryId: z.coerce
            .number()
            .int()
            .positive("กรุณาเลือกหมวดหมู่"),
        variants: z
            .array(variantSchema)
            .min(1, "กรุณาเพิ่มรายการย่อยอย่างน้อย 1 รายการ")
            .max(20, "เพิ่มรายการย่อยได้สูงสุด 20 รายการ"),
    })
    .superRefine((data, ctx) => {
        if (data.variants.length > 1) {
            for (let index = 0; index < data.variants.length; index += 1) {
                const variant = data.variants[index];

                if (variant.attributes.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["variants", index, "attributes"],
                        message:
                            "ถ้ามีหลายรายการย่อย แต่ละรายการต้องระบุคุณสมบัติอย่างน้อย 1 รายการ",
                    });
                    return;
                }
            }
        }

        const signatures = new Set<string>();

        for (let index = 0; index < data.variants.length; index += 1) {
            const variant = data.variants[index];
            const signature = variant.attributes
                .map((attribute) =>
                    `${attribute.name.toLowerCase()}:${attribute.value.toLowerCase()}`,
                )
                .sort()
                .join("|");

            if (!signature) {
                continue;
            }

            if (signatures.has(signature)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["variants", index, "attributes"],
                    message: "ชุดคุณสมบัติของรายการย่อยซ้ำกัน",
                });
                return;
            }

            signatures.add(signature);
        }
    });

const updateItemVariantSchema = z
    .object({
        id: z.coerce.number().int().positive("กรุณาเลือกรายการย่อย").optional(),
        sku: z
            .string()
            .max(50, "รหัส SKU ของรายการย่อยต้องไม่เกิน 50 ตัวอักษร")
            .trim()
            .optional(),
        unit: z
            .string({ message: "กรุณากรอกหน่วยของรายการย่อย" })
            .min(1, "กรุณากรอกหน่วยของรายการย่อย")
            .max(50, "หน่วยของรายการย่อยต้องไม่เกิน 50 ตัวอักษร")
            .trim(),
        quantity: z.coerce
            .number()
            .int("จำนวนของรายการย่อยต้องเป็นจำนวนเต็ม")
            .min(0, "จำนวนของรายการย่อยต้องไม่ติดลบ"),
        minStock: z.coerce
            .number()
            .int("จุดสั่งซื้อของรายการย่อยต้องเป็นจำนวนเต็ม")
            .min(1, "จุดสั่งซื้อของรายการย่อยต้องมากกว่า 0"),
        imageUrl: imageUrlSchema.nullish(),
        attributes: z
            .array(variantAttributeSchema)
            .max(5, "ใส่คุณสมบัติได้สูงสุด 5 รายการ")
            .default([]),
    })
    .superRefine((variant, ctx) => {
        const seen = new Set<string>();

        for (let index = 0; index < variant.attributes.length; index += 1) {
            const attribute = variant.attributes[index];
            const key = attribute.name.toLowerCase();

            if (seen.has(key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["attributes", index, "name"],
                    message: "ชื่อคุณสมบัติซ้ำกันในรายการย่อยเดียวกัน",
                });
                return;
            }

            seen.add(key);
        }
    });

export const updateItemSchema = z
    .object({
        name: z.string().min(1).max(200).trim().optional(),
        description: z.string().max(2000).trim().nullish(),
        imageUrl: imageUrlSchema.nullish(),
        sku: z.string().min(1).max(50).trim().optional(),
        unit: z.string().min(1).max(50).trim().optional(),
        minStock: z.coerce.number().int().min(1).optional(),
        categoryId: z.coerce.number().int().positive().optional(),
        isActive: z.boolean().optional(),
        variants: z
            .array(updateItemVariantSchema)
            .min(1, "กรุณาระบุรายการย่อยอย่างน้อย 1 รายการ")
            .max(20, "แก้ไขรายการย่อยได้สูงสุด 20 รายการ")
            .optional(),
    })
    .superRefine((data, ctx) => {
        if (!data.variants) {
            return;
        }

        if (data.variants.length > 1) {
            for (let index = 0; index < data.variants.length; index += 1) {
                const variant = data.variants[index];

                if (variant.attributes.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["variants", index, "attributes"],
                        message:
                            "ถ้ามีหลายรายการย่อย แต่ละรายการต้องระบุคุณสมบัติอย่างน้อย 1 รายการ",
                    });
                    return;
                }
            }
        }

        const seenIds = new Set<number>();
        const signatures = new Set<string>();

        for (let index = 0; index < data.variants.length; index += 1) {
            const variant = data.variants[index];

            if (variant.id !== undefined) {
                if (seenIds.has(variant.id)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["variants", index, "id"],
                        message: "ห้ามระบุรายการย่อยซ้ำ",
                    });
                    return;
                }

                seenIds.add(variant.id);
            }

            const signature = variant.attributes
                .map((attribute) =>
                    `${attribute.name.toLowerCase()}:${attribute.value.toLowerCase()}`,
                )
                .sort()
                .join("|");

            if (!signature) {
                continue;
            }

            if (signatures.has(signature)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["variants", index, "attributes"],
                    message: "ชุดคุณสมบัติของรายการย่อยซ้ำกัน",
                });
                return;
            }

            signatures.add(signature);
        }
    });

export const adjustStockSchema = z
    .object({
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
    })
    .superRefine((data, ctx) => {
        if (data.type === StockTxType.IN && data.quantity < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["quantity"],
                message: "รับเข้า (IN) ต้องเป็นจำนวนบวก",
            });
        }
    });

const requestItemSchema = z
    .object({
        itemId: z.coerce
            .number()
            .int()
            .positive("กรุณาเลือกรายการวัสดุ")
            .optional(),
        variantId: z.coerce
            .number()
            .int()
            .positive("กรุณาเลือกรายการย่อย")
            .optional(),
        quantity: z.coerce
            .number()
            .int("จำนวนต้องเป็นจำนวนเต็ม")
            .positive("จำนวนต้องมากกว่า 0"),
    })
    .superRefine((item, ctx) => {
        if (!item.itemId && !item.variantId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["itemId"],
                message: "กรุณาเลือกรายการวัสดุ",
            });
        }
    });

const projectCodeSchema = z
    .string({ message: "กรุณากรอกรหัสโครงการ" })
    .trim()
    .min(1, "กรุณากรอกรหัสโครงการ")
    .max(100, "รหัสโครงการต้องไม่เกิน 100 ตัวอักษร")
    .regex(
        /^[A-Za-z0-9/_\-\s]+$/,
        "รหัสโครงการใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข เว้นวรรค / _ -",
    )
    .transform((value) => value.toUpperCase());

export const createRequestSchema = z
    .object({
        projectCode: projectCodeSchema,
        items: z
            .array(requestItemSchema)
            .min(1, "กรุณาเลือกอย่างน้อย 1 รายการ")
            .max(20, "เบิกได้สูงสุด 20 รายการต่อครั้ง"),
        note: z.string().max(1000).trim().nullish(),
    })
    .superRefine((data, ctx) => {
        const seen = new Set<string>();

        for (let i = 0; i < data.items.length; i += 1) {
            const item = data.items[i];
            const itemKey = item.variantId
                ? `variant:${item.variantId}`
                : `item:${item.itemId}`;

            if (seen.has(itemKey)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["items", i, item.variantId ? "variantId" : "itemId"],
                    message: "ห้ามเลือกรายการวัสดุซ้ำ",
                });
                return;
            }

            seen.add(itemKey);
        }
    });

export const issueRequestSchema = z.object({});

export const cancelRequestSchema = z.object({
    cancelReason: z.string().max(500).trim().nullish(),
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
    search: z.preprocess(emptyToUndefined, z.string().max(100).trim().optional()),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type IssueRequestInput = z.infer<typeof issueRequestSchema>;
export type CancelRequestInput = z.infer<typeof cancelRequestSchema>;
export type StockItemsFilter = z.infer<typeof stockItemsFilterSchema>;
export type StockRequestsFilter = z.infer<typeof stockRequestsFilterSchema>;
