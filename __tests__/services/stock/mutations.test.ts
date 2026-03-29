import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { stockService } from "@/lib/services/stock";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("Stock Service Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$transaction.mockImplementation(async (arg) => {
            const callback = arg as (client: PrismaClient) => unknown;
            return callback(prismaMock as unknown as PrismaClient);
        });
        prismaMock.stockItemVariant.findFirst.mockResolvedValue(null as never);
    });

    describe("issueRequest", () => {
        it("should reject when aggregated duplicate items exceed stock", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    status: "PENDING_ISSUE",
                    items: [
                        { itemId: 10, variantId: null, quantity: 3 },
                        { itemId: 10, variantId: null, quantity: 3 },
                    ],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 10,
                        sku: "SKU-10",
                        unit: "ด้าม",
                        quantity: 5,
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                    },
                ]),
            );
            prismaMock.stockItemVariant.create.mockResolvedValue(
                asNever({ id: 101 }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 101,
                        stockItemId: 10,
                        unit: "ด้าม",
                        quantity: 5,
                        stockItem: { name: "ปากกา" },
                    },
                ]),
            );

            await expect(stockService.issueRequest(77, 5)).rejects.toThrow(
                "มีไม่เพียงพอ",
            );
            expect(prismaMock.stockItemVariant.updateMany).not.toHaveBeenCalled();
        });

        it("should guard race condition when conditional update cannot decrement", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    status: "PENDING_ISSUE",
                    items: [{ itemId: 11, variantId: null, quantity: 2 }],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 11,
                        sku: "SKU-11",
                        unit: "รีม",
                        quantity: 10,
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                    },
                ]),
            );
            prismaMock.stockItemVariant.create.mockResolvedValue(
                asNever({ id: 111 }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 111,
                        stockItemId: 11,
                        unit: "รีม",
                        quantity: 10,
                        stockItem: { name: "กระดาษ" },
                    },
                ]),
            );
            prismaMock.stockItemVariant.updateMany.mockResolvedValue(
                asNever({ count: 0 }),
            );
            prismaMock.stockItemVariant.findUnique.mockResolvedValue(
                asNever({
                    unit: "รีม",
                    quantity: 1,
                    stockItem: { name: "กระดาษ" },
                }),
            );

            await expect(stockService.issueRequest(88, 9)).rejects.toThrow(
                "มีไม่เพียงพอ",
            );
            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 111,
                        quantity: { gte: 2 },
                    }),
                }),
            );
        });

        it("should decrement by aggregated quantity once per variant", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    status: "PENDING_ISSUE",
                    items: [
                        { itemId: 10, variantId: null, quantity: 2 },
                        { itemId: 10, variantId: null, quantity: 3 },
                        { itemId: 12, variantId: null, quantity: 1 },
                    ],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 10,
                        sku: "SKU-10",
                        unit: "ด้าม",
                        quantity: 20,
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                    },
                    {
                        id: 12,
                        sku: "SKU-12",
                        unit: "เล่ม",
                        quantity: 7,
                        minStock: 1,
                        imageUrl: null,
                        isActive: true,
                    },
                ]),
            );
            prismaMock.stockItemVariant.create
                .mockResolvedValueOnce(asNever({ id: 101 }))
                .mockResolvedValueOnce(asNever({ id: 121 }));
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 101,
                        stockItemId: 10,
                        unit: "ด้าม",
                        quantity: 20,
                        stockItem: { name: "ปากกา" },
                    },
                    {
                        id: 121,
                        stockItemId: 12,
                        unit: "เล่ม",
                        quantity: 7,
                        stockItem: { name: "สมุด" },
                    },
                ]),
            );
            prismaMock.stockItemVariant.updateMany.mockResolvedValue(
                asNever({ count: 1 }),
            );
            prismaMock.stockItem.update.mockResolvedValue(asNever({ id: 10 }));
            prismaMock.stockTransaction.create.mockResolvedValue(
                asNever({ id: 1 }),
            );
            prismaMock.stockRequest.update.mockResolvedValue(
                asNever({ id: 99, status: "ISSUED" }),
            );

            await stockService.issueRequest(99, 9);

            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: { id: 101, quantity: { gte: 5 } },
                    data: { quantity: { decrement: 5 } },
                }),
            );
            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: { id: 121, quantity: { gte: 1 } },
                    data: { quantity: { decrement: 1 } },
                }),
            );
            expect(prismaMock.stockRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: "ISSUED",
                        issuedById: 9,
                    }),
                }),
            );
        });
    });

    describe("createRequest", () => {
        it("should reject when available quantity is lower than requested after pending reserve", async () => {
            prismaMock.stockItemVariant.findMany
                .mockResolvedValueOnce(
                    asNever([{ id: 301, stockItemId: 30 }]),
                )
                .mockResolvedValueOnce(
                    asNever([
                        {
                            id: 301,
                            quantity: 5,
                            unit: "ชิ้น",
                            stockItem: { name: "เมาส์" },
                        },
                    ]),
                );
            prismaMock.stockRequestItem.findMany.mockResolvedValue(
                asNever([
                    { itemId: 30, variantId: 301, quantity: 3 },
                ]),
            );

            await expect(
                stockService.createRequest(
                    {
                        items: [{ variantId: 301, quantity: 3 }],
                    },
                    7,
                ),
            ).rejects.toThrow("มีไม่เพียงพอสำหรับเบิก");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should create request with normalized item and variant ids when stock is available", async () => {
            prismaMock.stockItemVariant.findMany
                .mockResolvedValueOnce(
                    asNever([{ id: 401, stockItemId: 40 }]),
                )
                .mockResolvedValueOnce(
                    asNever([
                        {
                            id: 401,
                            quantity: 10,
                            unit: "ชิ้น",
                            stockItem: { name: "คีย์บอร์ด" },
                        },
                    ]),
                );
            prismaMock.stockRequestItem.findMany.mockResolvedValue(
                asNever([
                    { itemId: 40, variantId: 401, quantity: 2 },
                ]),
            );
            prismaMock.stockRequest.create.mockResolvedValue(
                asNever({ id: 123, status: "PENDING_ISSUE" }),
            );

            await stockService.createRequest(
                {
                    items: [{ variantId: 401, quantity: 3 }],
                    note: "ทดสอบเบิก",
                },
                9,
            );

            expect(prismaMock.stockRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        requestedBy: 9,
                        note: "ทดสอบเบิก",
                        items: {
                            create: [{ itemId: 40, variantId: 401, quantity: 3 }],
                        },
                    }),
                }),
            );
        });
    });

    describe("cancelRequest", () => {
        it("should cancel only pending issue requests", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({ status: "PENDING_ISSUE", requestedBy: 3 }),
            );
            prismaMock.stockRequest.update.mockResolvedValue(
                asNever({ id: 55, status: "CANCELLED" }),
            );

            await stockService.cancelRequest(55, 3, "ผู้เบิกไม่มารับ");

            expect(prismaMock.stockRequest.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 55 },
                    data: expect.objectContaining({
                        status: "CANCELLED",
                        cancelReason: "ผู้เบิกไม่มารับ",
                        cancelledById: 3,
                    }),
                }),
            );
        });

        it("should reject when non-admin tries to cancel another user's request", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({ status: "PENDING_ISSUE", requestedBy: 8 }),
            );

            await expect(
                stockService.cancelRequest(55, 3, null, { isAdmin: false }),
            ).rejects.toThrow("ไม่มีสิทธิ์ยกเลิกคำขอนี้");
            expect(prismaMock.stockRequest.update).not.toHaveBeenCalled();
        });
    });

    describe("updateItem", () => {
        it("should sync parent stock totals from variants", async () => {
            prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue(
                asNever({
                    id: 25,
                    sku: "SKU-25",
                    unit: "ชิ้น",
                    quantity: 10,
                    minStock: 3,
                    imageUrl: null,
                    isActive: true,
                }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([
                    { id: 251, sku: "SKU-25-A", imageUrl: null },
                    { id: 252, sku: "SKU-25-B", imageUrl: null },
                ]),
            );
            prismaMock.stockItem.update
                .mockResolvedValueOnce(
                    asNever({
                        id: 25,
                        sku: "SKU-25",
                        imageUrl: null,
                    }),
                )
                .mockResolvedValueOnce(asNever({ id: 25 }));
            prismaMock.stockItemVariant.update.mockResolvedValue(asNever({ id: 251 }));
            prismaMock.stockVariantAttributeValue.deleteMany.mockResolvedValue(
                asNever({ count: 1 }),
            );
            prismaMock.stockAttribute.upsert.mockResolvedValue(
                asNever({ id: 1 }),
            );
            prismaMock.stockAttributeValue.upsert.mockResolvedValue(
                asNever({ id: 11 }),
            );
            prismaMock.stockVariantAttributeValue.create.mockResolvedValue(
                asNever({ variantId: 251, attributeValueId: 11 }),
            );
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({ id: 25, variants: [] }),
            );

            await stockService.updateItem(25, {
                variants: [
                    {
                        id: 251,
                        sku: "SKU-25-A",
                        unit: "ชิ้น",
                        quantity: 4,
                        minStock: 2,
                        attributes: [{ name: "สี", value: "แดง" }],
                    },
                    {
                        id: 252,
                        sku: "SKU-25-B",
                        unit: "ชิ้น",
                        quantity: 6,
                        minStock: 3,
                        attributes: [{ name: "สี", value: "น้ำเงิน" }],
                    },
                ],
            });

            expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 25 },
                    data: expect.objectContaining({
                        unit: "ชิ้น",
                        quantity: 10,
                        minStock: 5,
                    }),
                }),
            );
            expect(prismaMock.stockItemVariant.update).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: { id: 251 },
                    data: expect.objectContaining({
                        quantity: 4,
                        minStock: 2,
                    }),
                }),
            );
            expect(prismaMock.stockItemVariant.update).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: { id: 252 },
                    data: expect.objectContaining({
                        quantity: 6,
                        minStock: 3,
                    }),
                }),
            );
        });

        it("should create new variants and soft-delete removed referenced variants", async () => {
            prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue(
                asNever({
                    id: 26,
                    sku: "SKU-26",
                    unit: "ชิ้น",
                    quantity: 8,
                    minStock: 2,
                    imageUrl: null,
                    isActive: true,
                }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([
                    { id: 261, sku: "SKU-26-A", imageUrl: null, isActive: true },
                    { id: 262, sku: "SKU-26-B", imageUrl: null, isActive: true },
                ]),
            );
            prismaMock.stockItem.update
                .mockResolvedValueOnce(
                    asNever({
                        id: 26,
                        sku: "SKU-26",
                        imageUrl: null,
                    }),
                )
                .mockResolvedValueOnce(asNever({ id: 26 }));
            prismaMock.stockItemVariant.update.mockResolvedValue(asNever({ id: 261 }));
            prismaMock.stockItemVariant.create.mockResolvedValueOnce(
                asNever({ id: 263 }),
            );
            prismaMock.stockVariantAttributeValue.deleteMany.mockResolvedValue(
                asNever({ count: 1 }),
            );
            prismaMock.stockAttribute.upsert.mockResolvedValue(asNever({ id: 1 }));
            prismaMock.stockAttributeValue.upsert.mockResolvedValue(
                asNever({ id: 11 }),
            );
            prismaMock.stockVariantAttributeValue.create.mockResolvedValue(
                asNever({ variantId: 263, attributeValueId: 11 }),
            );
            prismaMock.stockTransaction.findFirst.mockResolvedValue(
                asNever({ id: 1 }),
            );
            prismaMock.stockRequestItem.findFirst.mockResolvedValue(null as never);
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({ id: 26, variants: [] }),
            );

            await stockService.updateItem(26, {
                variants: [
                    {
                        id: 261,
                        sku: "SKU-26-A",
                        unit: "ชิ้น",
                        quantity: 2,
                        minStock: 1,
                        attributes: [{ name: "สี", value: "แดง" }],
                    },
                    {
                        unit: "ชิ้น",
                        quantity: 4,
                        minStock: 2,
                        attributes: [{ name: "สี", value: "เขียว" }],
                    },
                ],
            });

            expect(prismaMock.stockItemVariant.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        stockItemId: 26,
                        quantity: 4,
                        minStock: 2,
                    }),
                }),
            );
            expect(prismaMock.stockItemVariant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 262 },
                    data: { isActive: false },
                }),
            );
        });
    });
});
