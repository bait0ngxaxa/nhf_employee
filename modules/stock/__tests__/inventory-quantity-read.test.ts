import { describe, expect, it } from "vitest";

import {
    summarizeVariantInventory,
    withVariantInventorySummary,
} from "../domain/inventory-quantity-read";

describe("stock inventory quantity reads", () => {
    it("summarizes quantity and reorder points from variants only", () => {
        expect(summarizeVariantInventory([
            { quantity: 4, minStock: 2 },
            { quantity: 6, minStock: 3 },
        ])).toEqual({
            quantity: 10,
            minStock: 5,
        });
    });

    it("returns zero inventory when there are no active variants", () => {
        expect(summarizeVariantInventory([])).toEqual({
            quantity: 0,
            minStock: 0,
        });
    });

    it("overwrites legacy parent inventory with the variant summary", () => {
        expect(withVariantInventorySummary({
            id: 7,
            quantity: 999,
            minStock: 999,
            variants: [
                { quantity: 4, minStock: 2 },
                { quantity: 6, minStock: 3 },
            ],
        })).toEqual({
            id: 7,
            quantity: 10,
            minStock: 5,
            variants: [
                { quantity: 4, minStock: 2 },
                { quantity: 6, minStock: 3 },
            ],
        });
    });
});
