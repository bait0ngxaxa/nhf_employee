import { Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";
import { describe, expect, it } from "vitest";
import { updateItemWithVariants } from "../infrastructure/persistence/item-update.variant-sync";
import type { SubmittedVariant } from "../infrastructure/persistence/item-update.types";

describe("rename-away/create submitted-order characterization", () => {
    it.each([false, true])("rename first = %s preserves main's behavior", async (renameFirst) => {
        const tx = mockDeep<PrismaClient>();
        const holders = new Map([[11, "X"]]);
        const item = { id: 1, sku: "ITEM", unit: "ชิ้น", imageUrl: null, isActive: true, variants: [] };
        tx.stockItem.findUniqueOrThrow.mockResolvedValue(item as never);
        tx.stockItem.update.mockResolvedValue(item as never);
        tx.stockItem.findUnique.mockResolvedValue({ defaultVariantId: 11, defaultVariant: { stockItemId: 1, isActive: true } } as never);
        tx.stockItemVariant.findMany.mockResolvedValue([{ id: 11, sku: "X", quantity: 0, imageUrl: null, isActive: true }] as never);
        tx.stockTransaction.upsert.mockResolvedValue({ id: 91 } as never);
        // SQL's early snapshot matches X to A; SQL does not decide whether A has moved by create time.
        tx.$queryRaw.mockResolvedValue([{ ordinal: renameFirst ? 1 : 0, existingId: 11, occurrence: 1 }]);
        tx.stockItemVariant.updateMany.mockImplementation((args) => {
            if (args.data.sku === "Y") holders.set(11, "Y");
            return { count: 1 } as never;
        });
        tx.stockItemVariant.create.mockImplementation((args) => {
            if ([...holders.values()].includes(String(args.data.sku))) {
                throw new Prisma.PrismaClientKnownRequestError("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว", { code: "P2002", clientVersion: "test" });
            }
            holders.set(12, String(args.data.sku));
            return { id: 12 } as never;
        });
        const rename: SubmittedVariant = { id: 11, expectedQuantity: 0, sku: "Y", unit: "ชิ้น", quantity: 0, minStock: 1, attributes: [] };
        const create: SubmittedVariant = { sku: "X", unit: "ชิ้น", quantity: 0, minStock: 1, attributes: [] };
        const saving = updateItemWithVariants(tx, 1, {}, renameFirst ? [rename, create] : [create, rename], 7, {
            cleanupCandidates: new Set(), retainedUploadUrls: new Set(), transactionIdsByVariantId: new Map(),
        });
        if (renameFirst) {
            await expect(saving).resolves.toMatchObject({ id: 1 });
            expect(holders).toEqual(new Map([[11, "Y"], [12, "X"]]));
            expect(tx.stockItemVariant.create).toHaveBeenCalledTimes(1);
        } else {
            await expect(saving).rejects.toThrow("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว");
            expect(holders).toEqual(new Map([[11, "X"]]));
            expect(tx.stockItemVariant.updateMany).not.toHaveBeenCalled();
        }
    });
});
