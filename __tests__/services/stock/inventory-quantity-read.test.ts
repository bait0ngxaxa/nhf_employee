import { describe, expect, it, vi } from "vitest";

import {
    buildInventoryQuantityShadowComparison,
    isVariantInventoryReadEnabled,
    reportInventoryQuantityShadowComparison,
    resolveInventoryQuantity,
} from "@/lib/services/stock/inventory-quantity-read";

describe("stock inventory quantity reads", () => {
    it.each([
        [undefined, false],
        ["", false],
        ["false", false],
        ["TRUE", true],
        [" 1 ", true],
    ])("parses a fail-closed feature flag value %j", (value, expected) => {
        expect(isVariantInventoryReadEnabled(value)).toBe(expected);
    });

    it("keeps the legacy quantity while the flag is disabled", () => {
        expect(resolveInventoryQuantity({
            legacyQuantity: 20,
            variantQuantity: 12,
            variantReadEnabled: false,
        })).toBe(20);
    });

    it("uses the variant quantity while the flag is enabled", () => {
        expect(resolveInventoryQuantity({
            legacyQuantity: 20,
            variantQuantity: 12,
            variantReadEnabled: true,
        })).toBe(12);
    });

    it("classifies and reports a parent/variant mismatch without changing data", () => {
        const comparison = buildInventoryQuantityShadowComparison({
            itemId: 7,
            itemSku: "ITEM-007",
            parentQuantity: 20,
            variantQuantity: 12,
        });
        const warn = vi.fn();

        reportInventoryQuantityShadowComparison(comparison, warn);

        expect(comparison).toEqual({
            itemId: 7,
            itemSku: "ITEM-007",
            parentQuantity: 20,
            variantQuantity: 12,
            difference: 8,
            classification: "MISMATCH",
        });
        expect(warn).toHaveBeenCalledWith(
            "Stock inventory quantity shadow mismatch",
            comparison,
        );
    });

    it("does not warn when parent and variant quantities match", () => {
        const comparison = buildInventoryQuantityShadowComparison({
            itemId: 8,
            itemSku: "ITEM-008",
            parentQuantity: 12,
            variantQuantity: 12,
        });
        const warn = vi.fn();

        reportInventoryQuantityShadowComparison(comparison, warn);

        expect(comparison.classification).toBe("MATCH");
        expect(warn).not.toHaveBeenCalled();
    });
});
