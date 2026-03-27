import { describe, expect, it } from "vitest";
import {
    adjustStockSchema,
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
    });
});
