import { Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { beforeEach, describe, expect, it } from "vitest";
import { updateItemWithVariants } from "../infrastructure/persistence/item-update.variant-sync";
import type { SubmittedVariant } from "../infrastructure/persistence/item-update.types";

const tx = mockDeep<PrismaClient>();
const duplicate = (): Error => new Prisma.PrismaClientKnownRequestError(
    "รหัสวัสดุ (SKU) นี้มีอยู่แล้ว", { code: "P2002", clientVersion: "test" },
);
const submitted = (sku: string, id?: number): SubmittedVariant => ({
    ...(id === undefined ? {} : { id, expectedQuantity: 0 }),
    sku, unit: "ชิ้น", quantity: 0, minStock: 1, attributes: [],
});
function save(variants: SubmittedVariant[]): ReturnType<typeof updateItemWithVariants> {
    return updateItemWithVariants(tx, 1, {}, variants, 7, {
        cleanupCandidates: new Set(), retainedUploadUrls: new Set(),
        transactionIdsByVariantId: new Map(),
    });
}

describe("variant sync error precedence (writes stay in submitted order)", () => {
    beforeEach(() => {
        mockReset(tx);
        tx.stockItem.findUniqueOrThrow.mockResolvedValue({ id: 1, sku: "ITEM", unit: "ชิ้น", imageUrl: null, isActive: true } as never);
        tx.stockItem.update.mockResolvedValue({ id: 1, sku: "ITEM", imageUrl: null, isActive: true } as never);
        tx.stockItemVariant.findMany.mockResolvedValue([
            { id: 11, sku: "X", quantity: 0, imageUrl: null, isActive: true },
            { id: 12, sku: "Y", quantity: 5, imageUrl: null, isActive: true },
        ] as never);
        tx.stockItemVariant.create.mockRejectedValue(duplicate());
        tx.stockItemVariant.updateMany.mockResolvedValue({ count: 1 });
    });

    it("stale quantity before a later duplicate SKU wins", async () => {
        tx.stockItemVariant.updateMany.mockResolvedValue({ count: 0 });
        await expect(save([submitted("X", 11), submitted("X")])).rejects.toThrow("ยอดคงเหลือของรายการย่อยเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่");
        expect(tx.stockItemVariant.create).not.toHaveBeenCalled();
    });

    it("duplicate SKU wins before checking pending requests on removals", async () => {
        tx.stockRequestItem.findFirst.mockResolvedValue({ id: 91 } as never);
        await expect(save([submitted("X")])).rejects.toThrow("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว");
        expect(tx.stockRequestItem.findFirst).not.toHaveBeenCalled();
    });

    it("duplicate SKU wins before checking non-zero quantity on removals", async () => {
        await expect(save([submitted("X")])).rejects.toThrow("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว");
        expect(tx.stockItemVariant.delete).not.toHaveBeenCalled();
    });

    it("remove X plus add X is intentionally rejected before removal", async () => {
        await expect(save([submitted("X")])).rejects.toThrow("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว");
        expect(tx.stockItemVariant.delete).not.toHaveBeenCalled();
    });

    it("swapping X and Y is intentionally rejected by the first update", async () => {
        tx.stockItemVariant.updateMany.mockRejectedValue(duplicate());
        await expect(save([submitted("Y", 11), submitted("X", 12)])).rejects.toThrow("รหัสวัสดุ (SKU) นี้มีอยู่แล้ว");
        expect(tx.stockItemVariant.updateMany).toHaveBeenCalledTimes(1);
        expect(tx.stockItemVariant.create).not.toHaveBeenCalled();
    });
});
