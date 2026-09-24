import { describe, expect, it } from "vitest";

import { getPreferredVariant } from "./stockVariant.shared";

describe("canonical Stock variant selection", () => {
    it("uses the explicit default even when another active variant has a lower ID", () => {
        const item = {
            id: 10,
            name: "เสื้อ",
            defaultVariantId: 102,
            variants: [
                {
                    id: 101,
                    sku: "SHIRT-S",
                    unit: "ตัว",
                    availableQuantity: 3,
                },
                {
                    id: 102,
                    sku: "SHIRT-M",
                    unit: "ตัว",
                    availableQuantity: 4,
                },
            ],
        };

        expect(getPreferredVariant(item)?.id).toBe(102);
    });

    it("does not choose any variant when the persisted default is null", () => {
        const item = {
            id: 10,
            name: "เสื้อ",
            defaultVariantId: null,
            variants: [{
                id: 101,
                sku: "SHIRT-S",
                unit: "ตัว",
                availableQuantity: 3,
            }],
        };

        expect(getPreferredVariant(item)).toBeNull();
    });
});
