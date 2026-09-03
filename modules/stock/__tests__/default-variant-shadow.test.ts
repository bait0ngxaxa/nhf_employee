import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";

import {
    buildDefaultVariantShadowComparison,
    buildResolvedDefaultVariantIds,
    isExplicitDefaultVariantReadEnabled,
    reportDefaultVariantShadowComparison,
    resolveDefaultVariantId,
} from "../domain/default-variant-shadow";
import { loadActiveDefaultVariantsByItemIds } from "../infrastructure/persistence/shared";

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("default variant runtime shadow comparison", () => {
    it("parses explicit default read flag values", () => {
        expect(isExplicitDefaultVariantReadEnabled("")).toBe(false);
        expect(isExplicitDefaultVariantReadEnabled("false")).toBe(false);
        expect(isExplicitDefaultVariantReadEnabled("invalid")).toBe(false);
        expect(isExplicitDefaultVariantReadEnabled("true")).toBe(true);
        expect(isExplicitDefaultVariantReadEnabled("1")).toBe(true);
    });

    it("switches to a valid explicit default only when the read flag is enabled", () => {
        const input = {
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 102,
            explicitDefaultIsUsable: true,
        };

        expect(resolveDefaultVariantId({
            ...input,
            explicitReadEnabled: false,
        })).toBe(101);
        expect(resolveDefaultVariantId({
            ...input,
            explicitReadEnabled: true,
        })).toBe(102);
    });

    it("falls back to legacy when the explicit default is missing or inactive", () => {
        expect(resolveDefaultVariantId({
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: 102,
            explicitDefaultIsUsable: false,
            explicitReadEnabled: true,
        })).toBe(101);
        expect(resolveDefaultVariantId({
            legacyDefaultVariantId: 101,
            explicitDefaultVariantId: null,
            explicitDefaultIsUsable: false,
            explicitReadEnabled: true,
        })).toBe(101);
    });

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

        const defaults = buildResolvedDefaultVariantIds([{
            id: 10,
            defaultVariantId: 102,
            variants: [
                { id: 102, isActive: true },
                { id: 101, isActive: true },
            ],
        }], warn, false);

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

    it("uses the explicit default in read models only when enabled and active", () => {
        const defaults = buildResolvedDefaultVariantIds([{
            id: 10,
            defaultVariantId: 102,
            variants: [
                { id: 101, isActive: true },
                { id: 102, isActive: true },
            ],
        }], vi.fn(), true);

        expect(defaults).toEqual(new Map([[10, 102]]));
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

        const defaults = await loadActiveDefaultVariantsByItemIds(
            tx,
            [10],
            { explicitReadEnabled: false },
        );

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

    it("returns a valid explicit default when runtime reads are enabled", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItemVariant.findMany.mockResolvedValue(asNever([
            { id: 101, stockItemId: 10 },
            { id: 102, stockItemId: 10 },
        ]));
        tx.stockItem.findMany.mockResolvedValue(asNever([{
            id: 10,
            defaultVariantId: 102,
            defaultVariant: { stockItemId: 10 },
        }]));
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const defaults = await loadActiveDefaultVariantsByItemIds(
            tx,
            [10],
            { explicitReadEnabled: true },
        );

        expect(defaults.get(10)).toEqual({ id: 102 });
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
