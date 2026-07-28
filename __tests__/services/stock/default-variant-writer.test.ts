import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";

import {
    InvalidStockDefaultVariantError,
    setStockItemDefaultVariantIfUnset,
} from "@/lib/services/stock/default-variant-writer";

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("explicit default variant writer", () => {
    it("sets an active variant owned by the item", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItem.updateMany.mockResolvedValue(asNever({ count: 1 }));

        await expect(setStockItemDefaultVariantIfUnset(
            tx,
            10,
            101,
        )).resolves.toBe(true);

        expect(tx.stockItem.findUnique).not.toHaveBeenCalled();
    });

    it("does not overwrite a default that another command already set", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItem.updateMany.mockResolvedValue(asNever({ count: 0 }));
        tx.stockItem.findUnique.mockResolvedValue(asNever({
            defaultVariantId: 101,
        }));

        await expect(setStockItemDefaultVariantIfUnset(
            tx,
            10,
            102,
        )).resolves.toBe(false);
    });

    it("rejects a variant that is not an active variant of the item", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();
        tx.stockItem.updateMany.mockResolvedValue(asNever({ count: 0 }));
        tx.stockItem.findUnique.mockResolvedValue(asNever({
            defaultVariantId: null,
        }));

        await expect(setStockItemDefaultVariantIfUnset(
            tx,
            10,
            202,
        )).rejects.toBeInstanceOf(InvalidStockDefaultVariantError);

        expect(tx.stockItem.updateMany).toHaveBeenCalledWith({
            where: {
                id: 10,
                defaultVariantId: null,
                variants: {
                    some: {
                        id: 202,
                        isActive: true,
                    },
                },
            },
            data: { defaultVariantId: 202 },
        });
    });
});
