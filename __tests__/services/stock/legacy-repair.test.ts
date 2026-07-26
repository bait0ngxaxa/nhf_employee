import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import { repairLegacyStockItemVariants } from "@/lib/services/stock/legacy-repair";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

const actor = {
    id: 7,
    email: "admin@example.com",
    name: "Admin",
    authority: "ADMIN" as const,
};

describe("Stock legacy variant repair", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$transaction.mockImplementation(async (arg) => {
            const callback = arg as (client: PrismaClient) => unknown;
            return callback(prismaMock as unknown as PrismaClient);
        });
        prismaMock.stockItemVariant.findMany.mockResolvedValue(asNever([]));
        prismaMock.stockItemVariant.findUnique.mockResolvedValue(null as never);
        prismaMock.stockItemVariant.create.mockResolvedValue(asNever({ id: 11 }));
        prismaMock.stockTransaction.upsert.mockResolvedValue(asNever({ id: 101 }));
        prismaMock.auditLog.create.mockResolvedValue(asNever({ id: 201 }));
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            role: "ADMIN",
            isActive: true,
            deletedAt: null,
        }));
    });

    it("repairs a missing variant once and is idempotent on rerun", async () => {
        prismaMock.stockItem.findUnique.mockResolvedValue({
            id: 10,
            sku: "SKU-10",
            quantity: 8,
            unit: "ชิ้น",
            minStock: 1,
            imageUrl: null,
            isActive: true,
        } as never);

        const first = await repairLegacyStockItemVariants(actor, [10], { dryRun: false });
        expect(first.summary).toEqual({
            requested: 1,
            legacyCandidates: 1,
            repaired: 1,
            skipped: 0,
            conflicted: 0,
            failed: 0,
        });
        expect(prismaMock.stockItemVariant.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.stockTransaction.upsert).toHaveBeenCalledTimes(1);
        expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);

        prismaMock.stockItemVariant.findMany.mockResolvedValue(asNever([{
            id: 11,
            stockItemId: 10,
            sku: "SKU-10",
            isActive: true,
        }]));

        const second = await repairLegacyStockItemVariants(actor, [10]);
        expect(second.summary).toEqual({
            requested: 1,
            legacyCandidates: 0,
            repaired: 0,
            skipped: 1,
            conflicted: 0,
            failed: 0,
        });
        expect(prismaMock.stockItemVariant.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.stockTransaction.upsert).toHaveBeenCalledTimes(1);
        expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it("dry-run reports the legacy item without writing", async () => {
        prismaMock.stockItem.findUnique.mockResolvedValue(asNever({
            id: 10,
            sku: "SKU-10",
            quantity: 8,
            unit: "ชิ้น",
            minStock: 1,
            imageUrl: null,
            isActive: true,
        }));

        const result = await repairLegacyStockItemVariants(actor, [10], { dryRun: true });
        expect(result.dryRun).toBe(true);
        expect(result.summary.skipped).toBe(1);
        expect(prismaMock.stockItemVariant.create).not.toHaveBeenCalled();
        expect(prismaMock.stockTransaction.upsert).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    });

    it("distinguishes an existing inactive variant from a missing variant", async () => {
        prismaMock.stockItem.findUnique.mockResolvedValue(asNever({
            id: 10,
            sku: "SKU-10",
            quantity: 8,
            unit: "ชิ้น",
            minStock: 1,
            imageUrl: null,
            isActive: false,
        }));
        prismaMock.stockItemVariant.findMany.mockResolvedValue(asNever([{
            id: 11,
            stockItemId: 10,
            sku: "SKU-10",
            isActive: false,
        }]));

        const result = await repairLegacyStockItemVariants(actor, [10], { dryRun: false });
        expect(result.items[0]).toMatchObject({
            status: "skipped",
            persistedVariantCount: 1,
            activeVariantCount: 0,
            inactiveVariantCount: 1,
        });
        expect(prismaMock.stockItemVariant.create).not.toHaveBeenCalled();
    });
});
