import { type PrismaClient } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";
import { describe, expect, it } from "vitest";
import { loadVariantSkuConflicts } from "../infrastructure/persistence/variant-sku-check";

describe("SKU holder release decisions use SQL matches and submitted order", () => {
    it.each([
        { label: "earlier rename releases holder", rows: [{ ordinal: 1, existingId: 11, occurrence: 1 }], ids: [11, undefined], blocked: [] },
        { label: "later rename cannot release holder yet", rows: [{ ordinal: 0, existingId: 11, occurrence: 1 }], ids: [undefined, 11], blocked: [0] },
        { label: "collation-equivalent update keeps holder", rows: [{ ordinal: 0, existingId: 11, occurrence: 1 }, { ordinal: 1, existingId: 11, occurrence: 2 }], ids: [11, undefined], blocked: [0, 1] },
        { label: "earlier request duplicate survives holder release", rows: [{ ordinal: 1, existingId: 11, occurrence: 1 }, { ordinal: 2, existingId: 11, occurrence: 2 }], ids: [11, undefined, undefined], blocked: [2] },
        { label: "non-submitted holders remain reserved", rows: [{ ordinal: 1, existingId: 99, occurrence: 1 }], ids: [11, undefined], blocked: [1] },
    ])("$label", async ({ rows, ids, blocked }) => {
        const tx = mockDeep<PrismaClient>();
        tx.$queryRaw.mockResolvedValue(rows);
        const result = await loadVariantSkuConflicts(tx, ids.map((_, index) => `SKU-${index}`), ids);
        expect([...result]).toEqual(blocked);
        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(tx.stockItemVariant.create).not.toHaveBeenCalled();
        expect(tx.stockItemVariant.updateMany).not.toHaveBeenCalled();
    });
});
