import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";

import {
    buildDefaultVariantShadowComparison,
    buildObservedLegacyDefaultVariantIds,
    reportDefaultVariantShadowComparison,
} from "@/lib/services/stock/default-variant-shadow";
import { loadActiveDefaultVariantsByItemIds } from "@/lib/services/stock/shared";

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("default variant runtime shadow comparison", () => {
    it("classifies matching explicit and legacy defaults", () => {
        expect(buildDefaultVariantShadowComparison({
            itemId: 10,
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 101,
            explicitDefaultVariantStockItemId: 10,
        })).toEqual({
            itemId: 10,
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 101,
            explicitDefaultVariantStockItemId: 10,
            classification: "MATCH",
        });
    });

    it("distinguishes missing, mismatched, and cross-item explicit defaults", () => {
        expect(buildDefaultVariantShadowComparison({
            itemId: 10,
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: null,
            explicitDefaultVariantStockItemId: null,
        }).classification).toBe("MISSING_EXPLICIT");
        expect(buildDefaultVariantShadowComparison({
            itemId: 10,
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 102,
            explicitDefaultVariantStockItemId: 10,
        }).classification).toBe("MISMATCH");
        expect(buildDefaultVariantShadowComparison({
            itemId: 10,
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 202,
            explicitDefaultVariantStockItemId: 20,
        }).classification).toBe("CROSS_ITEM_DEFAULT");
    });

    it("logs only non-matching shadow results without changing command behavior", () => {
        const warn = vi.fn();
        const match = buildDefaultVariantShadowComparison({
            itemId: 10,
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 101,
            explicitDefaultVariantStockItemId: 10,
        });
        const mismatch = buildDefaultVariantShadowComparison({
            itemId: 20,
            legacyDefaultVariantId: 201,
            explicitDefaultVariantId: 202,
            explicitDefaultVariantStockItemId: 20,
        });

        reportDefaultVariantShadowComparison(match, warn);
        reportDefaultVariantShadowComparison(mismatch, warn);

        expect(warn).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledWith(
            "Stock default variant shadow mismatch",
            mismatch,
        );
    });

    it("builds legacy default IDs for read models while shadowing explicit IDs", () => {
        const warn = vi.fn();

        const defaults = buildObservedLegacyDefaultVariantIds([{
            id: 10,
            defaultVariantId: 102,
            variants: [
                { id: 102, isActive: true },
                { id: 101, isActive: true },
            ],
        }], warn);

        expect(defaults).toEqual(new Map([[10, 101]]));
        expect(warn).toHaveBeenCalledWith(
            "Stock default variant shadow mismatch",
            expect.objectContaining({
                itemId: 10,
                legacyDefaultVariantId: 101,
                explicitDefaultVariantId: 102,
                classification: "MISMATCH",
            }),
        );
    });

    it("keeps returning the legacy lowest active ID while observing explicit mismatch", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItemVariant.findMany.mockResolvedValue(asNever([
            {
                id: 101,
                stockItemId: 10,
            },
            {
                id: 102,
                stockItemId: 10,
            },
        ]));
        tx.stockItem.findMany.mockResolvedValue(asNever([{
            id: 10,
            defaultVariantId: 102,
            defaultVariant: { stockItemId: 10 },
        }]));
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const defaults = await loadActiveDefaultVariantsByItemIds(tx, [10]);

        expect(defaults.get(10)).toEqual({ id: 101 });
        expect(warn).toHaveBeenCalledWith(
            "Stock default variant shadow mismatch",
            expect.objectContaining({
                itemId: 10,
                legacyDefaultVariantId: 101,
                explicitDefaultVariantId: 102,
                classification: "MISMATCH",
            }),
        );
        warn.mockRestore();
    });

    it("observes an explicit inactive default when no active legacy default exists", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItemVariant.findMany.mockResolvedValue(asNever([]));
        tx.stockItem.findMany.mockResolvedValue(asNever([{
            id: 10,
            defaultVariantId: 101,
            defaultVariant: { stockItemId: 10 },
        }]));
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const defaults = await loadActiveDefaultVariantsByItemIds(tx, [10]);

        expect(defaults.size).toBe(0);
        expect(warn).toHaveBeenCalledWith(
            "Stock default variant shadow mismatch",
            expect.objectContaining({
                itemId: 10,
                legacyDefaultVariantId: null,
                explicitDefaultVariantId: 101,
                classification: "MISMATCH",
            }),
        );
        warn.mockRestore();
    });
});
