import { describe, expect, it } from "vitest";
import {
    adjustStockSchema,
    createItemSchema,
    createRequestSchema,
    updateItemSchema,
} from "@/lib/validations/stock";

describe("Stock Validation", () => {
    describe("createRequestSchema", () => {
        it("should reject duplicate itemId in request items", () => {
            const result = createRequestSchema.safeParse({
                items: [
                    { itemId: 10, quantity: 1 },
                    { itemId: 10, quantity: 2 },
                ],
            });

            expect(result.success).toBe(false);
        });

        it("should accept request with unique itemId", () => {
            const result = createRequestSchema.safeParse({
                items: [
                    { itemId: 10, quantity: 1 },
                    { itemId: 11, quantity: 2 },
                ],
            });

            expect(result.success).toBe(true);
        });
    });

    describe("adjustStockSchema", () => {
        it("should reject negative quantity when type is IN", () => {
            const result = adjustStockSchema.safeParse({
                type: "IN",
                quantity: -1,
                minStock: 1,
            });

            expect(result.success).toBe(false);
        });

        it("should accept positive quantity when type is IN", () => {
            const result = adjustStockSchema.safeParse({
                type: "IN",
                quantity: 5,
                minStock: 2,
            });

            expect(result.success).toBe(true);
        });
    });

    describe("createItemSchema", () => {
        it("should require at least one variant", () => {
            const result = createItemSchema.safeParse({
                name: "Post-it",
                variants: [],
            });

            expect(result.success).toBe(false);
        });

        it("should accept item creation without parent stock fields when variant is present", () => {
            const result = createItemSchema.safeParse({
                name: "Post-it",
                imageUrl: "/api/uploads/stock/items/2026/03/item.webp",
                variants: [
                    {
                        unit: "แพ็ก",
                        quantity: 10,
                        minStock: 3,
                        imageUrl: "/api/uploads/stock/variants/2026/03/variant.webp",
                        attributes: [
                            { name: "สี", value: "ชมพู" },
                            { name: "ขนาด", value: "3x3" },
                        ],
                    },
                ],
            });

            expect(result.success).toBe(true);
        });

        it("should reject duplicate variant attribute combinations", () => {
            const result = createItemSchema.safeParse({
                name: "แฟ้มเอกสาร",
                variants: [
                    {
                        unit: "ชิ้น",
                        quantity: 5,
                        minStock: 2,
                        attributes: [
                            { name: "ขนาด", value: "กลาง" },
                            { name: "ชนิด", value: "ใส" },
                        ],
                    },
                    {
                        unit: "ชิ้น",
                        quantity: 7,
                        minStock: 2,
                        attributes: [
                            { name: "ชนิด", value: "ใส" },
                            { name: "ขนาด", value: "กลาง" },
                        ],
                    },
                ],
            });

            expect(result.success).toBe(false);
        });

        it("should reject multi-variant item when a variant has no attributes", () => {
            const result = createItemSchema.safeParse({
                name: "แฟ้มเอกสาร",
                variants: [
                    {
                        unit: "ชิ้น",
                        quantity: 5,
                        minStock: 2,
                        attributes: [{ name: "ขนาด", value: "กลาง" }],
                    },
                    {
                        unit: "ชิ้น",
                        quantity: 7,
                        minStock: 2,
                        attributes: [],
                    },
                ],
            });

            expect(result.success).toBe(false);
        });
    });

    describe("updateItemSchema", () => {
        it("should reject minStock less than 1", () => {
            const result = updateItemSchema.safeParse({
                minStock: 0,
            });

            expect(result.success).toBe(false);
        });

        it("should accept minStock equal to 1", () => {
            const result = updateItemSchema.safeParse({
                minStock: 1,
            });

            expect(result.success).toBe(true);
        });

        it("should accept variant quantity equal to 0 when editing stock", () => {
            const result = updateItemSchema.safeParse({
                variants: [
                    {
                        id: 1,
                        unit: "ชิ้น",
                        quantity: 0,
                        minStock: 1,
                        attributes: [],
                    },
                ],
            });

            expect(result.success).toBe(true);
        });

        it("should accept new variant without id when editing item", () => {
            const result = updateItemSchema.safeParse({
                variants: [
                    {
                        unit: "ชิ้น",
                        quantity: 3,
                        minStock: 1,
                        attributes: [{ name: "สี", value: "เขียว" }],
                    },
                ],
            });

            expect(result.success).toBe(true);
        });
    });
});
