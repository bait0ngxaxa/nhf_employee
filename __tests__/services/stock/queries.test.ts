import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { getItems } from "@/lib/services/stock/queries";
import { ensureItemVariantsExist } from "@/lib/services/stock/shared";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/services/stock/shared", async () => {
    const actual =
        await vi.importActual<typeof import("@/lib/services/stock/shared")>(
            "@/lib/services/stock/shared",
        );

    return {
        ...actual,
        ensureItemVariantsExist: vi.fn(),
    };
});

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("Stock Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(ensureItemVariantsExist).mockReset();
    });

    describe("getItems", () => {
        it("should append reserved and available quantities for items and variants", async () => {
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
                    {
                        id: 2,
                        name: "Keyboard",
                        sku: "ITEM-2",
                        quantity: 12,
                        unit: "ชิ้น",
                        minStock: 2,
                        imageUrl: null,
                        isActive: true,
                        categoryId: 1,
                        category: { id: 1, name: "General" },
                        variants: [
                            {
                                id: 21,
                                stockItemId: 2,
                                sku: "ITEM-2-BLACK",
                                quantity: 5,
                                unit: "ชิ้น",
                                minStock: 1,
                                imageUrl: null,
                                isActive: true,
                                attributeValues: [],
                            },
                            {
                                id: 22,
                                stockItemId: 2,
                                sku: "ITEM-2-WHITE",
                                quantity: 7,
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
            prismaMock.stockItem.count.mockResolvedValue(asNever(2));
            prismaMock.stockRequestItem.findMany.mockResolvedValue(
                asNever([
                    { itemId: 1, variantId: null, quantity: 4 },
                    { itemId: 2, variantId: 21, quantity: 3 },
                    { itemId: 2, variantId: 22, quantity: 2 },
                ]),
            );

            const result = await getItems({
                page: 1,
                limit: 20,
                activeOnly: true,
            });

            expect(result.total).toBe(2);
            expect(result.items).toHaveLength(2);
            expect(result.items[0]).toMatchObject({
                id: 1,
                reservedQuantity: 4,
                availableQuantity: 6,
            });
            expect(result.items[0]?.variants[0]).toMatchObject({
                id: 11,
                reservedQuantity: 4,
                availableQuantity: 6,
            });
            expect(result.items[1]).toMatchObject({
                id: 2,
                reservedQuantity: 5,
                availableQuantity: 7,
            });
            expect(result.items[1]?.variants).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 21,
                        reservedQuantity: 3,
                        availableQuantity: 2,
                    }),
                    expect.objectContaining({
                        id: 22,
                        reservedQuantity: 2,
                        availableQuantity: 5,
                    }),
                ]),
            );
        });

        it("should create missing default variants and refetch items", async () => {
            prismaMock.stockItem.findMany
                .mockResolvedValueOnce(
                    asNever([
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
                    ]),
                )
                .mockResolvedValueOnce(
                    asNever([
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
                            variants: [
                                {
                                    id: 31,
                                    stockItemId: 3,
                                    sku: "ITEM-3",
                                    quantity: 8,
                                    unit: "เล่ม",
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
            prismaMock.stockRequestItem.findMany.mockResolvedValue(asNever([]));

            const result = await getItems({
                page: 1,
                limit: 20,
            });

            expect(vi.mocked(ensureItemVariantsExist)).toHaveBeenCalledWith([3]);
            expect(prismaMock.stockItem.findMany).toHaveBeenCalledTimes(2);
            expect(result.items[0]?.variants[0]).toMatchObject({
                id: 31,
                availableQuantity: 8,
                reservedQuantity: 0,
            });
        });
    });
});
