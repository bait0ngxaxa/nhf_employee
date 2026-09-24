import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";

import { resolveCanonicalDefaultVariantId } from "../domain/canonical-default-variant";
import { selectPreferredDefaultVariantId } from "../domain/default-variant-policy";
import { StockInvariantViolationError } from "../domain/errors";
import { loadCanonicalDefaultVariantsByItemIds } from "../infrastructure/persistence/shared";

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("canonical Stock default variant", () => {
    it("selects the lowest active ID for mutation-time replacement policy", () => {
        expect(selectPreferredDefaultVariantId([
            { id: 102, isActive: true },
            { id: 100, isActive: false },
            { id: 101, isActive: true },
        ])).toBe(101);
        expect(selectPreferredDefaultVariantId([
            { id: 100, isActive: false },
        ])).toBeNull();
    });

    it("uses the explicit active same-item default even when another variant has a lower ID", () => {
        expect(resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: 102,
            defaultVariant: {
                id: 102,
                stockItemId: 10,
                isActive: true,
            },
            activeVariantIds: [101, 102],
        })).toBe(102);
    });

    it("accepts no active variants with a null default without inventing one", () => {
        expect(resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: null,
            defaultVariant: null,
            activeVariantIds: [],
        })).toBeNull();
    });

    it("rejects active variants with a missing explicit default", () => {
        expect(() => resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: null,
            defaultVariant: null,
            activeVariantIds: [101],
        })).toThrow(StockInvariantViolationError);
    });

    it("rejects an inactive explicit default", () => {
        expect(() => resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: 102,
            defaultVariant: {
                id: 102,
                stockItemId: 10,
                isActive: false,
            },
            activeVariantIds: [101],
        })).toThrow(StockInvariantViolationError);
    });

    it("rejects an explicit default owned by another item", () => {
        expect(() => resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: 202,
            defaultVariant: {
                id: 202,
                stockItemId: 20,
                isActive: true,
            },
            activeVariantIds: [101],
        })).toThrow(StockInvariantViolationError);
    });

    it("rejects a non-null default when its variant is missing", () => {
        expect(() => resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: 202,
            defaultVariant: null,
            activeVariantIds: [101],
        })).toThrow(StockInvariantViolationError);
    });

    it("rejects a non-null default when the item has no active variants", () => {
        expect(() => resolveCanonicalDefaultVariantId({
            itemId: 10,
            defaultVariantId: 102,
            defaultVariant: {
                id: 102,
                stockItemId: 10,
                isActive: true,
            },
            activeVariantIds: [],
        })).toThrow(StockInvariantViolationError);
    });

    it("loads only the explicit default for each requested item", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItemVariant.findMany.mockResolvedValue(asNever([
            { id: 101, stockItemId: 10 },
            { id: 102, stockItemId: 10 },
        ]));
        tx.stockItem.findMany.mockResolvedValue(asNever([{
            id: 10,
            defaultVariantId: 102,
            defaultVariant: {
                id: 102,
                stockItemId: 10,
                isActive: true,
            },
        }]));

        await expect(loadCanonicalDefaultVariantsByItemIds(tx, [10]))
            .resolves.toEqual(new Map([[10, { id: 102 }]]));
    });

    it("does not fabricate a default when the requested item has no active variants", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItemVariant.findMany.mockResolvedValue(asNever([]));
        tx.stockItem.findMany.mockResolvedValue(asNever([{
            id: 10,
            defaultVariantId: null,
            defaultVariant: null,
        }]));

        await expect(loadCanonicalDefaultVariantsByItemIds(tx, [10]))
            .resolves.toEqual(new Map());
    });
});
