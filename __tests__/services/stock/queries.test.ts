import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import { getCategories, getItemById, getItems, getRequests } from "@/lib/services/stock/queries";
import { StockInvariantViolationError } from "@/lib/services/stock/shared";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("Stock Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("getItems", () => {
        it("uses summed active variant inventory", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(asNever([{
                id: 1,
                name: "Mouse",
                sku: "ITEM-1",
                quantity: 99,
                unit: "ชิ้น",
                minStock: 3,
                imageUrl: null,
                isActive: true,
                categoryId: 1,
                defaultVariantId: 11,
                category: { id: 1, name: "General" },
                variants: [
                    {
                        id: 11,
                        quantity: 4,
                        minStock: 2,
                        isActive: true,
                        attributeValues: [],
                    },
                    {
                        id: 12,
                        quantity: 6,
                        minStock: 3,
                        isActive: true,
                        attributeValues: [],
                    },
                ],
            }]));
            prismaMock.stockItem.count.mockResolvedValue(asNever(1));
            prismaMock.stockRequestItem.findMany.mockResolvedValue(asNever([
                { itemId: 1, variantId: 11, quantity: 3 },
            ]));
            const result = await getItems({ page: 1, limit: 20 });

            expect(result.items[0]).toMatchObject({
                id: 1,
                quantity: 10,
                minStock: 5,
                reservedQuantity: 3,
                availableQuantity: 7,
            });
        });

        it("ignores legacy parent inventory", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(asNever([{
                id: 1,
                name: "Mouse",
                sku: "ITEM-1",
                quantity: 99,
                unit: "ชิ้น",
                minStock: 99,
                imageUrl: null,
                isActive: true,
                categoryId: 1,
                defaultVariantId: 11,
                category: { id: 1, name: "General" },
                variants: [{
                    id: 11,
                    quantity: 10,
                    minStock: 5,
                    isActive: true,
                    attributeValues: [],
                }],
            }]));
            prismaMock.stockItem.count.mockResolvedValue(asNever(1));
            prismaMock.stockRequestItem.findMany.mockResolvedValue(asNever([]));
            const result = await getItems({ page: 1, limit: 20 });

            expect(result.items[0]).toMatchObject({
                id: 1,
                quantity: 10,
                minStock: 5,
                availableQuantity: 10,
            });
        });

        it("aggregates pending reservations by item and variant", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(asNever([{
                id: 1,
                name: "Keyboard",
                sku: "ITEM-1",
                quantity: 12,
                unit: "ชิ้น",
                minStock: 2,
                imageUrl: null,
                isActive: true,
                categoryId: 1,
                category: { id: 1, name: "General" },
                variants: [
                    {
                        id: 11,
                        stockItemId: 1,
                        sku: "ITEM-1-BLACK",
                        quantity: 5,
                        unit: "ชิ้น",
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                        attributeValues: [],
                    },
                    {
                        id: 12,
                        stockItemId: 1,
                        sku: "ITEM-1-WHITE",
                        quantity: 7,
                        unit: "ชิ้น",
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                        attributeValues: [],
                    },
                ],
            }]));
            prismaMock.stockItem.count.mockResolvedValue(asNever(1));
            prismaMock.stockRequestItem.findMany.mockResolvedValue(asNever([
                { itemId: 1, variantId: 11, quantity: 3 },
                { itemId: 1, variantId: 12, quantity: 2 },
            ]));

            const result = await getItems({ page: 1, limit: 20 });

            expect(result.items[0]).toMatchObject({
                id: 1,
                reservedQuantity: 5,
                availableQuantity: 7,
            });
            expect(result.items[0]?.variants).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 11,
                        reservedQuantity: 3,
                        availableQuantity: 2,
                    }),
                    expect.objectContaining({
                        id: 12,
                        reservedQuantity: 2,
                        availableQuantity: 5,
                    }),
                ]),
            );
        });

        it("should reject pending requests without a variant snapshot", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 1,
                        name: "Mouse",
                        sku: "ITEM-1",
                        quantity: 10,
                        unit: "ชิ้น",
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                        categoryId: 1,
                        category: { id: 1, name: "General" },
                        variants: [
                            {
                                id: 11,
                                stockItemId: 1,
                                sku: "ITEM-1",
                                quantity: 10,
                                unit: "ชิ้น",
                                minStock: 1,
                                imageUrl: null,
                                isActive: true,
                                attributeValues: [],
                            },
                        ],
                    },
                ]),
            );
            prismaMock.stockItem.count.mockResolvedValue(asNever(1));
            prismaMock.stockRequestItem.findMany.mockResolvedValue(
                asNever([
                    { itemId: 1, variantId: null, quantity: 4 },
                ]),
            );

            await expect(getItems({
                page: 1,
                limit: 20,
                activeOnly: true,
            })).rejects.toBeInstanceOf(StockInvariantViolationError);
            expect(prismaMock.stockItemVariant.create).not.toHaveBeenCalled();
            expect(prismaMock.stockItemVariant.update).not.toHaveBeenCalled();
            expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
            expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
        });

        it("should reject an item with no persisted variant without writing", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(asNever([
                {
                    id: 3,
                    name: "Notebook",
                    sku: "ITEM-3",
                    quantity: 8,
                    unit: "เล่ม",
                    minStock: 1,
                    imageUrl: null,
                    isActive: true,
                    categoryId: 1,
                    category: { id: 1, name: "General" },
                    variants: [],
                },
            ]));
            prismaMock.stockItemVariant.findMany.mockResolvedValue(asNever([]));
            const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

            try {
                await expect(getItems({
                    page: 1,
                    limit: 20,
                })).rejects.toThrow("ข้อมูลวัสดุไม่สอดคล้อง");

                expect(prismaMock.stockItem.findMany).toHaveBeenCalledTimes(1);
                expect(prismaMock.stockItemVariant.findMany).toHaveBeenCalledTimes(1);
                expect(consoleError).toHaveBeenCalledWith(
                    "Stock invariant violation: item has no variant",
                    { itemId: 3, sku: "ITEM-3" },
                );
                expect(prismaMock.stockItemVariant.create).not.toHaveBeenCalled();
                expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
                expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
            } finally {
                consoleError.mockRestore();
            }
        });

        it("should keep an item with only inactive persisted variants without writing", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(asNever([{
                id: 4,
                name: "Inactive item",
                sku: "ITEM-4",
                quantity: 8,
                unit: "ชิ้น",
                minStock: 1,
                imageUrl: null,
                isActive: false,
                categoryId: 1,
                category: { id: 1, name: "General" },
                variants: [],
            }]));
            prismaMock.stockItemVariant.findMany.mockResolvedValue(asNever([
                { stockItemId: 4 },
            ]));
            prismaMock.stockItem.count.mockResolvedValue(asNever(1));
            prismaMock.stockRequestItem.findMany.mockResolvedValue(asNever([]));

            const result = await getItems({
                page: 1,
                limit: 20,
            });

            expect(result.items[0]?.variants).toEqual([]);
            expect(prismaMock.stockItemVariant.create).not.toHaveBeenCalled();
            expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
        });
    });

    describe("read-only detail and categories", () => {
        it("uses summed active variant quantity for item detail when enabled", async () => {
            prismaMock.stockItem.findUnique.mockResolvedValue(asNever({
                id: 5,
                name: "Keyboard",
                sku: "ITEM-5",
                quantity: 50,
                unit: "ชิ้น",
                minStock: 2,
                imageUrl: null,
                isActive: true,
                categoryId: 1,
                defaultVariantId: 51,
                category: { id: 1, name: "General" },
                variants: [
                    {
                        id: 51,
                        quantity: 7,
                        minStock: 2,
                        isActive: true,
                        attributeValues: [],
                    },
                    {
                        id: 52,
                        quantity: 8,
                        minStock: 3,
                        isActive: true,
                        attributeValues: [],
                    },
                ],
            }));
            const result = await getItemById(5);

            expect(result?.quantity).toBe(15);
            expect(result?.minStock).toBe(5);
        });

        it("should reject item detail with no persisted variant without writing", async () => {
            prismaMock.stockItem.findUnique.mockResolvedValue(asNever({
                id: 3,
                name: "Notebook",
                sku: "ITEM-3",
                quantity: 8,
                unit: "เล่ม",
                minStock: 1,
                imageUrl: null,
                isActive: true,
                categoryId: 1,
                category: { id: 1, name: "General" },
                variants: [],
            }));
            prismaMock.stockItemVariant.findMany.mockResolvedValue(asNever([]));
            const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

            try {
                await expect(getItemById(3)).rejects.toThrow("ข้อมูลวัสดุไม่สอดคล้อง");

                expect(prismaMock.stockItem.findUnique).toHaveBeenCalledTimes(1);
                expect(prismaMock.stockItemVariant.findMany).toHaveBeenCalledTimes(1);
                expect(prismaMock.stockItemVariant.create).not.toHaveBeenCalled();
                expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
                expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
            } finally {
                consoleError.mockRestore();
            }
        });

        it("should list categories without creating the default category", async () => {
            prismaMock.stockCategory.findMany.mockResolvedValue(asNever([]));

            await expect(getCategories()).resolves.toEqual([]);

            expect(prismaMock.stockCategory.upsert).not.toHaveBeenCalled();
            expect(prismaMock.stockCategory.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe("getRequests", () => {
        it("should search stock requests by projectCode for admin scope all", async () => {
            prismaMock.stockRequest.findMany.mockResolvedValue(asNever([]));
            prismaMock.stockRequest.count.mockResolvedValue(asNever(0));

            await getRequests(
                {
                    search: "PRJ-2569",
                    page: 1,
                    limit: 10,
                },
                99,
                true,
                "all",
            );

            expect(prismaMock.stockRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            { projectCode: { contains: "PRJ-2569" } },
                        ]),
                    }),
                }),
            );
            expect(prismaMock.stockRequest.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            { projectCode: { contains: "PRJ-2569" } },
                        ]),
                    }),
                }),
            );
        });

        it("should keep my-request scope for admin when scope is mine", async () => {
            prismaMock.stockRequest.findMany.mockResolvedValue(asNever([]));
            prismaMock.stockRequest.count.mockResolvedValue(asNever(0));

            await getRequests(
                {
                    page: 1,
                    limit: 10,
                },
                7,
                true,
                "mine",
            );

            expect(prismaMock.stockRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        requestedBy: 7,
                    }),
                }),
            );
        });

        it("searches requester nickname without widening request scope", async () => {
            prismaMock.stockRequest.findMany.mockResolvedValue(asNever([]));
            prismaMock.stockRequest.count.mockResolvedValue(asNever(0));

            await getRequests(
                { search: "ชาย", page: 1, limit: 10 },
                7,
                false,
                "mine",
            );

            expect(prismaMock.stockRequest.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        requestedBy: 7,
                        OR: expect.arrayContaining([
                            {
                                requester: {
                                    employee: {
                                        is: {
                                            OR: expect.arrayContaining([
                                                { nickname: { contains: "ชาย" } },
                                            ]),
                                        },
                                    },
                                },
                            },
                        ]),
                    }),
                }),
            );
        });
    });
});
