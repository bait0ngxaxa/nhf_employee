import { describe, expect, it } from "vitest";
import {
    parseVariantMinStock,
    parseVariantQuantity,
} from "@/components/dashboard/stock/StockInventoryEditDialog";

describe("stock inventory edit parsers", () => {
    it("allows an existing variant quantity to be zero", () => {
        expect(parseVariantQuantity("0")).toBe(0);
    });

    it("keeps minStock at a minimum of one", () => {
        expect(parseVariantMinStock("0")).toBe(1);
    });
});
