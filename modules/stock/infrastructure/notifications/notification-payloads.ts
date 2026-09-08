import type { Prisma } from "@prisma/client";
import * as z from "zod";
import { getUserDisplayName } from "@/shared/identity/display";
import { lineRetryKeySchema } from "@/lib/validations/line";
import type {
    StockLowLineData,
    StockRequestLineData,
} from "../../contracts/notifications";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

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

const stockRequestResultRecipientSchema = z.object({
    userId: z.number().int().positive(),
    name: z.string().trim().min(1),
    email: z.string().trim().min(1),
});

const stockRequestResultEmailRecipientSchema =
    stockRequestResultRecipientSchema.extend({
        email: z.string().trim().email(),
    });

const stockRequestResultItemsSchema = z.array(z.object({
    name: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unit: z.string().trim().min(1),
    variantLabel: z.string().trim().min(1).optional(),
})).min(1);

const stockRequestResultPayloadSchema = z.object({
    schemaVersion: z.literal(1),
    requestId: z.number().int().positive(),
    status: stockRequestResultStatusSchema,
    projectCode: z.string().trim().min(1),
    recipient: stockRequestResultRecipientSchema,
    items: stockRequestResultItemsSchema,
    cancelReason: z.string().nullable(),
    actedAt: dateStringSchema,
});

const stockRequestResultEmailPayloadSchema =
    stockRequestResultPayloadSchema.extend({
        recipient: stockRequestResultEmailRecipientSchema,
    });

export const stockRequestResultLinePayloadSchema =
    stockRequestResultPayloadSchema.extend({
        retryKey: lineRetryKeySchema,
    });

export type StockRequestResultEmailPayload = z.infer<
    typeof stockRequestResultEmailPayloadSchema
>;

export type StockRequestResultStatus =
    StockRequestResultEmailPayload["status"];

export type StockRequestResultLinePayload = z.infer<
    typeof stockRequestResultLinePayloadSchema
>;

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
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    nickname: true,
                },
            },
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
    const requesterName = getUserDisplayName(request.requester);

    return {
        schemaVersion: 1,
        requestId: request.id,
        status,
        projectCode: request.projectCode,
        recipient: {
            userId: request.requestedBy,
            name: requesterName,
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

export function parseStockRequestResultLinePayload(
    payload: unknown,
): StockRequestResultLinePayload {
    const result = stockRequestResultLinePayloadSchema.safeParse(payload);
    if (!result.success) {
        throw new Error("Invalid STOCK_REQUEST_RESULT_LINE payload");
    }

    return result.data;
}

function parseStockRequestItems(
    items: unknown[],
): StockRequestLineData["items"] {
    return items.map((item, index) => {
        if (
            !isRecord(item) ||
            typeof item.name !== "string" ||
            typeof item.quantity !== "number" ||
            typeof item.unit !== "string"
        ) {
            throw new Error(`Invalid STOCK_REQUEST_LINE payload item at index ${index}`);
        }

        return {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            variantLabel:
                typeof item.variantLabel === "string" ? item.variantLabel : undefined,
        };
    });
}

function parseStockLowItems(items: unknown[]): StockLowLineData["items"] {
    return items.map((item, index) => {
        if (
            !isRecord(item) ||
            typeof item.itemId !== "number" ||
            typeof item.quantity !== "number" ||
            typeof item.minStock !== "number" ||
            typeof item.unit !== "string"
        ) {
            throw new Error(`Invalid STOCK_LOW_LINE payload item at index ${index}`);
        }

        if ("variantId" in item) {
            if (
                typeof item.variantId !== "number" ||
                typeof item.itemName !== "string" ||
                typeof item.variantSku !== "string" ||
                typeof item.variantLabel !== "string"
            ) {
                throw new Error(`Invalid STOCK_LOW_LINE variant item at index ${index}`);
            }

            return {
                itemId: item.itemId,
                variantId: item.variantId,
                itemName: item.itemName,
                variantSku: item.variantSku,
                variantLabel: item.variantLabel,
                quantity: item.quantity,
                minStock: item.minStock,
                unit: item.unit,
            };
        }

        if (typeof item.name !== "string" || typeof item.sku !== "string") {
            throw new Error(`Invalid STOCK_LOW_LINE aggregate item at index ${index}`);
        }

        return {
            itemId: item.itemId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
        };
    });
}

export function parseStockRequestLinePayload(
    payload: unknown,
): StockRequestLineData {
    if (
        !isRecord(payload) ||
        typeof payload.requestId !== "number" ||
        typeof payload.projectCode !== "string" ||
        typeof payload.requesterName !== "string" ||
        typeof payload.requestedAt !== "string" ||
        typeof payload.itemCount !== "number" ||
        typeof payload.totalQuantity !== "number" ||
        !Array.isArray(payload.items)
    ) {
        throw new Error("Invalid STOCK_REQUEST_LINE payload");
    }

    return {
        requestId: payload.requestId,
        projectCode: payload.projectCode,
        requesterName: payload.requesterName,
        note: typeof payload.note === "string" ? payload.note : null,
        requestedAt: payload.requestedAt,
        itemCount: payload.itemCount,
        totalQuantity: payload.totalQuantity,
        items: parseStockRequestItems(payload.items),
    };
}

export function parseStockLowLinePayload(payload: unknown): StockLowLineData {
    if (
        !isRecord(payload) ||
        typeof payload.alertedAt !== "string" ||
        typeof payload.itemCount !== "number" ||
        !Array.isArray(payload.items)
    ) {
        throw new Error("Invalid STOCK_LOW_LINE payload");
    }

    return {
        alertedAt: payload.alertedAt,
        itemCount: payload.itemCount,
        items: parseStockLowItems(payload.items),
    };
}
