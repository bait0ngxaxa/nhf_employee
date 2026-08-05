import type { Prisma } from "@prisma/client";
import * as z from "zod";

export function buildVariantLabel(
    attributeValues: Array<{
        attributeValue: {
            value: string;
            attribute: {
                name: string;
            };
        };
    }>,
): string | undefined {
    if (attributeValues.length === 0) {
        return undefined;
    }

    return attributeValues
        .map(({ attributeValue }) => {
            return `${attributeValue.attribute.name}: ${attributeValue.value}`;
        })
        .join(", ");
}

const dateStringSchema = z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Invalid date string",
    });

const stockRequestResultStatusSchema = z.enum(["ISSUED", "CANCELLED"]);

const stockRequestResultEmailPayloadSchema = z.object({
    schemaVersion: z.literal(1),
    requestId: z.number().int().positive(),
    status: stockRequestResultStatusSchema,
    projectCode: z.string().trim().min(1),
    recipient: z.object({
        userId: z.number().int().positive(),
        name: z.string().trim().min(1),
        email: z.string().trim().min(1),
    }),
    items: z.array(z.object({
        name: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        unit: z.string().trim().min(1),
        variantLabel: z.string().trim().min(1).optional(),
    })).min(1),
    cancelReason: z.string().nullable(),
    actedAt: dateStringSchema,
});

export type StockRequestResultEmailPayload = z.infer<
    typeof stockRequestResultEmailPayloadSchema
>;

export type StockRequestResultStatus =
    StockRequestResultEmailPayload["status"];

export const stockRequestResultEmailSelect = {
    id: true,
    requestedBy: true,
    projectCode: true,
    status: true,
    requester: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },
    items: {
        select: {
            id: true,
            itemId: true,
            variantId: true,
            quantity: true,
            item: {
                select: {
                    name: true,
                    unit: true,
                },
            },
            variant: {
                select: {
                    unit: true,
                    attributeValues: {
                        select: {
                            attributeValue: {
                                select: {
                                    value: true,
                                    attribute: {
                                        select: { name: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
} as const satisfies Prisma.StockRequestSelect;

export type StockRequestResultEmailSource = Prisma.StockRequestGetPayload<{
    select: typeof stockRequestResultEmailSelect;
}>;

export function buildStockRequestResultEmailPayload(
    request: StockRequestResultEmailSource,
    status: StockRequestResultStatus,
    cancelReason: string | null,
    actedAt: Date,
): StockRequestResultEmailPayload {
    return {
        schemaVersion: 1,
        requestId: request.id,
        status,
        projectCode: request.projectCode,
        recipient: {
            userId: request.requestedBy,
            name: request.requester.name,
            email: request.requester.email,
        },
        items: request.items.map((item) => {
            const variantLabel = item.variant
                ? buildVariantLabel(item.variant.attributeValues)
                : undefined;
            const resultItem = {
                name: item.item.name,
                quantity: item.quantity,
                unit: item.variant?.unit ?? item.item.unit,
            };

            return variantLabel
                ? { ...resultItem, variantLabel }
                : resultItem;
        }),
        cancelReason,
        actedAt: actedAt.toISOString(),
    };
}

export function parseStockRequestResultEmailPayload(
    payload: unknown,
): StockRequestResultEmailPayload {
    const result = stockRequestResultEmailPayloadSchema.safeParse(payload);
    if (!result.success) {
        throw new Error("Invalid STOCK_REQUEST_RESULT_EMAIL payload");
    }

    return result.data;
}
