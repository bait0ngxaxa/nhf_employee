import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import { stockService } from "@/lib/services/stock";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function commandActor(id: number): {
    id: number;
    email: string;
    name: string;
} {
    return {
        id,
        email: "user-" + id + "@example.com",
        name: "ผู้ใช้ " + id,
    };
}

function requestOptions(): { idempotencyKey: string } {
    return { idempotencyKey: "stock-request-test-key" };
}

describe("Stock Service Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$transaction.mockImplementation(async (arg) => {
            const callback = arg as (client: PrismaClient) => unknown;
            return callback(prismaMock as unknown as PrismaClient);
        });
        prismaMock.stockItemVariant.findFirst.mockResolvedValue(null as never);
        prismaMock.stockRequest.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.stockItemVariant.aggregate.mockResolvedValue(
            asNever({ _sum: { quantity: 10, minStock: 5 } }),
        );
        prismaMock.stockItemVariant.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.stockRequestItem.findMany.mockResolvedValue(asNever([]));
        prismaMock.user.findMany.mockResolvedValue(asNever([]));
        prismaMock.stockRequest.findUniqueOrThrow.mockResolvedValue(
            asNever({ id: 55, requestedBy: 3 }),
        );
    });

    describe("issueRequest", () => {
        it("should not issue stock when another transaction has already claimed the request", async () => {
            prismaMock.stockRequest.updateMany.mockResolvedValue(
                asNever({ count: 0 }),
            );
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({ status: "ISSUED" }),
            );

            await expect(stockService.issueRequest(99, commandActor(9))).rejects.toThrow(
                "คำขอนี้ถูกดำเนินการแล้ว",
            );

            expect(prismaMock.stockRequest.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 99, status: "PENDING_ISSUE" },
                    data: expect.objectContaining({
                        status: "ISSUED",
                        issuedById: 9,
                        issuedAt: expect.any(Date),
                    }),
                }),
            );
            expect(prismaMock.stockItemVariant.updateMany).not.toHaveBeenCalled();
            expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
        });

        it("should reject when aggregated duplicate items exceed stock", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    status: "PENDING_ISSUE",
                    requestedBy: 3,
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
                        sku: "SKU-101",
                        unit: "ด้าม",
                        quantity: 5,
                        minStock: 0,
                        stockItem: { name: "ปากกา" },
                        attributeValues: [],
                    },
                ]),
            );

            await expect(stockService.issueRequest(77, commandActor(5))).rejects.toThrow(
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
                        sku: "SKU-111",
                        unit: "รีม",
                        quantity: 10,
                        minStock: 0,
                        stockItem: { name: "กระดาษ" },
                        attributeValues: [],
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

            await expect(stockService.issueRequest(88, commandActor(9))).rejects.toThrow(
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
                    requestedBy: 3,
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
                        name: "ปากกา",
                        sku: "SKU-10",
                        unit: "ด้าม",
                        quantity: 6,
                        minStock: 5,
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
                        sku: "SKU-101",
                        unit: "ด้าม",
                        quantity: 20,
                        minStock: 0,
                        stockItem: { name: "ปากกา" },
                        attributeValues: [],
                    },
                    {
                        id: 121,
                        stockItemId: 12,
                        sku: "SKU-121",
                        unit: "เล่ม",
                        quantity: 7,
                        minStock: 0,
                        stockItem: { name: "สมุด" },
                        attributeValues: [],
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
            await stockService.issueRequest(99, commandActor(9));

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
            expect(prismaMock.stockRequest.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 99, status: "PENDING_ISSUE" },
                    data: expect.objectContaining({
                        status: "ISSUED",
                        issuedById: 9,
                    }),
                }),
            );
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "STOCK_REQUEST_ISSUE",
                        entityId: 99,
                    }),
                }),
            );
            expect(prismaMock.notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 3,
                        type: "STOCK_ISSUED",
                    }),
                }),
            );
            expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: "STOCK_LOW_LINE",
                    }),
                }),
            );
        });

        it("should alert for a variant crossing its threshold while aggregate stock stays high", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    requestedBy: 3,
                    items: [{ itemId: 10, variantId: 101, quantity: 5 }],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([{
                    id: 10,
                    name: "หมึกพิมพ์",
                    sku: "INK",
                    unit: "ตลับ",
                    quantity: 106,
                    minStock: 10,
                }]),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([{
                    id: 101,
                    stockItemId: 10,
                    sku: "INK-BLACK",
                    unit: "ตลับ",
                    quantity: 6,
                    minStock: 5,
                    stockItem: { name: "หมึกพิมพ์" },
                    attributeValues: [{
                        attributeValue: {
                            value: "ดำ",
                            attribute: { name: "สี" },
                        },
                    }],
                }]),
            );
            prismaMock.stockItem.update.mockResolvedValue(asNever({ id: 10 }));
            prismaMock.stockTransaction.create.mockResolvedValue(asNever({ id: 1 }));

            const result = await stockService.issueRequest(99, commandActor(9));

            expect(result.lowStockAlerts).toEqual([{
                itemId: 10,
                variantId: 101,
                itemName: "หมึกพิมพ์",
                variantSku: "INK-BLACK",
                variantLabel: "สี: ดำ",
                quantity: 1,
                minStock: 5,
                unit: "ตลับ",
            }]);
            expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: "STOCK_LOW_LINE",
                        payload: expect.stringContaining('"variantId":101'),
                    }),
                }),
            );
        });

        it("should retry P2034 and lock variants and items in ascending ID order", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    requestedBy: 3,
                    items: [
                        { itemId: 10, variantId: 200, quantity: 2 },
                        { itemId: 20, variantId: 100, quantity: 3 },
                    ],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 20,
                        name: "กระดาษ",
                        sku: "PAPER-20",
                        unit: "รีม",
                        quantity: 10,
                        minStock: 1,
                    },
                    {
                        id: 10,
                        name: "ปากกา",
                        sku: "PEN-10",
                        unit: "ด้าม",
                        quantity: 10,
                        minStock: 1,
                    },
                ]),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([
                    {
                        id: 200,
                        stockItemId: 10,
                        sku: "SKU-200",
                        unit: "ด้าม",
                        quantity: 10,
                        minStock: 0,
                        stockItem: { name: "ปากกา" },
                        attributeValues: [],
                    },
                    {
                        id: 100,
                        stockItemId: 20,
                        sku: "SKU-100",
                        unit: "รีม",
                        quantity: 10,
                        minStock: 0,
                        stockItem: { name: "กระดาษ" },
                        attributeValues: [],
                    },
                ]),
            );
            prismaMock.stockItem.update.mockResolvedValue(asNever({ id: 10 }));
            prismaMock.stockTransaction.create.mockResolvedValue(asNever({ id: 1 }));
            prismaMock.$transaction.mockRejectedValueOnce({ code: "P2034" });

            await stockService.issueRequest(99, commandActor(9));

            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ where: { id: 100, quantity: { gte: 3 } } }),
            );
            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ where: { id: 200, quantity: { gte: 2 } } }),
            );
            expect(prismaMock.stockItem.update).toHaveBeenNthCalledWith(1, {
                where: { id: 10 },
                data: { quantity: { decrement: 2 } },
            });
            expect(prismaMock.stockItem.update).toHaveBeenNthCalledWith(2, {
                where: { id: 20 },
                data: { quantity: { decrement: 3 } },
            });
            expect(prismaMock.$transaction).toHaveBeenCalledWith(
                expect.any(Function),
                {
                    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                },
            );
            expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
        });
    });

    describe("adjustStock", () => {
        it("should atomically adjust the selected variant and cached parent aggregate by delta", async () => {
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({
                    id: 10,
                    name: "หมึกพิมพ์",
                    sku: "INK-10",
                    unit: "ตลับ",
                    quantity: 12,
                    minStock: 4,
                    imageUrl: null,
                    isActive: true,
                }),
            );
            prismaMock.stockItemVariant.findFirst.mockResolvedValue(
                asNever({ id: 102, quantity: 4, minStock: 2 }),
            );
            prismaMock.stockItemVariant.updateMany.mockResolvedValue(
                asNever({ count: 1 }),
            );
            prismaMock.stockItem.update.mockResolvedValue(
                asNever({ quantity: 15, minStock: 7 }),
            );
            prismaMock.stockTransaction.create.mockResolvedValue(asNever({ id: 1 }));

            const result = await stockService.adjustStock(
                10,
                { type: "IN", quantity: 3, minStock: 5, variantId: 102 },
                commandActor(9),
            );

            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 102,
                    stockItemId: 10,
                    isActive: true,
                    minStock: 2,
                },
                data: {
                    quantity: { increment: 3 },
                    minStock: 5,
                },
            });
            expect(prismaMock.stockItem.update).toHaveBeenCalledWith({
                where: { id: 10 },
                data: {
                    quantity: { increment: 3 },
                    minStock: { increment: 3 },
                },
                select: { quantity: true, minStock: true },
            });
            expect(result).toMatchObject({
                variantId: 102,
                previousQty: 12,
                newQty: 15,
                previousMinStock: 4,
                newMinStock: 7,
            });
        });

        it("should require a selected variant when multiple active variants exist", async () => {
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({
                    id: 10,
                    name: "หมึกพิมพ์",
                    sku: "INK-10",
                    unit: "ตลับ",
                    quantity: 12,
                    minStock: 4,
                    imageUrl: null,
                    isActive: true,
                }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([{ id: 101 }, { id: 102 }]),
            );

            await expect(
                stockService.adjustStock(
                    10,
                    { type: "IN", quantity: 3, minStock: 5 },
                    commandActor(9),
                ),
            ).rejects.toThrow("กรุณาเลือกรายการย่อยของวัสดุ");
            expect(prismaMock.stockItemVariant.updateMany).not.toHaveBeenCalled();
        });
    });

    describe("createRequest", () => {
        const replayPayload = {
            projectCode: "PRJ-REPLAY",
            items: [{ itemId: 50, variantId: 501, quantity: 1 }],
        };
        const replayRequestHash =
            "754a463c6c01837c67a1b6ee5d3d9b9e36d2f6ff0f8adc3ef38fe76e265e6e57";

        it("should return the original request for the same key and payload", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(asNever({
                id: 91,
                requestHash: replayRequestHash,
                projectCode: "PRJ-REPLAY",
                items: [],
            }));

            const result = await stockService.createRequest(
                replayPayload,
                commandActor(7),
                requestOptions(),
            );

            expect(result).toEqual({
                request: expect.objectContaining({ id: 91 }),
                replayed: true,
            });
            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
            expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
            expect(prismaMock.notification.create).not.toHaveBeenCalled();
            expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
        });

        it("should reject a reused key when its payload hash differs", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(asNever({
                id: 91,
                requestHash: "different-request-hash",
                projectCode: "PRJ-OLD",
                items: [],
            }));

            await expect(
                stockService.createRequest(
                    replayPayload,
                    commandActor(7),
                    requestOptions(),
                ),
            ).rejects.toThrow("Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should recover the winning request after a concurrent unique conflict", async () => {
            const existingRequest = {
                id: 91,
                requestHash: replayRequestHash,
                projectCode: "PRJ-REPLAY",
                items: [],
            };
            prismaMock.stockRequest.findUnique
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(asNever(existingRequest));
            prismaMock.stockItemVariant.findMany
                .mockResolvedValueOnce(asNever([{
                    id: 501,
                    stockItemId: 50,
                    isActive: true,
                    stockItem: { isActive: true },
                }]))
                .mockResolvedValueOnce(asNever([{
                    id: 501,
                    quantity: 10,
                    unit: "ชิ้น",
                    stockItem: { name: "จอภาพ" },
                }]));
            prismaMock.stockRequest.create.mockRejectedValue({ code: "P2002" });

            const result = await stockService.createRequest(
                replayPayload,
                commandActor(7),
                requestOptions(),
            );

            expect(result).toEqual({
                request: existingRequest,
                replayed: true,
            });
            expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
        });

        it("should retry a serialization conflict and then replay the winner", async () => {
            prismaMock.$transaction.mockRejectedValueOnce({ code: "P2034" });
            prismaMock.stockRequest.findUnique.mockResolvedValue(asNever({
                id: 92,
                requestHash: replayRequestHash,
                projectCode: "PRJ-REPLAY",
                items: [],
            }));

            const result = await stockService.createRequest(
                replayPayload,
                commandActor(7),
                requestOptions(),
            );

            expect(result.replayed).toBe(true);
            expect(result.request.id).toBe(92);
            expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should persist request, audit, in-app notification, and outbox atomically", async () => {
            prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 1 }]));
            prismaMock.stockItemVariant.findMany
                .mockResolvedValueOnce(asNever([{ id: 501, stockItemId: 50, isActive: true, stockItem: { isActive: true } }]))
                .mockResolvedValueOnce(asNever([{ id: 501, quantity: 10, unit: "ชิ้น", stockItem: { name: "จอภาพ" } }]));
            prismaMock.stockRequest.create.mockResolvedValue(asNever({
                id: 1,
                projectCode: "PRJ-MATCH",
                note: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                requester: { name: "ผู้ใช้ 7", email: "user-7@example.com" },
                items: [],
            }));

            await stockService.createRequest({
                projectCode: "PRJ-MATCH",
                items: [{ itemId: 50, variantId: 501, quantity: 1 }],
            }, commandActor(7), requestOptions());

            expect(prismaMock.stockRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        items: { create: [{ itemId: 50, variantId: 501, quantity: 1 }] },
                    }),
                }),
            );
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "STOCK_REQUEST_CREATE",
                        entityId: 1,
                    }),
                }),
            );
            expect(prismaMock.notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 1,
                        type: "STOCK_REQUEST_NEW",
                    }),
                }),
            );
            expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        type: "STOCK_REQUEST_LINE",
                    }),
                }),
            );
        });

        it("should reject a variant that belongs to another item", async () => {
            prismaMock.stockItemVariant.findMany.mockResolvedValueOnce(
                asNever([{ id: 501, stockItemId: 51, isActive: true, stockItem: { isActive: true } }]),
            );

            await expect(stockService.createRequest({
                projectCode: "PRJ-MISMATCH",
                items: [{ itemId: 50, variantId: 501, quantity: 1 }],
            }, commandActor(7), requestOptions())).rejects.toThrow("รายการย่อยไม่ตรงกับวัสดุที่เลือก");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should reject a missing variant", async () => {
            prismaMock.stockItemVariant.findMany.mockResolvedValueOnce(asNever([]));

            await expect(stockService.createRequest({
                projectCode: "PRJ-MISSING",
                items: [{ itemId: 50, variantId: 999, quantity: 1 }],
            }, commandActor(7), requestOptions())).rejects.toThrow("ไม่พบรายการย่อยที่พร้อมใช้งาน");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should reject an inactive variant", async () => {
            prismaMock.stockItemVariant.findMany.mockResolvedValueOnce(
                asNever([{ id: 501, stockItemId: 50, isActive: false, stockItem: { isActive: true } }]),
            );

            await expect(stockService.createRequest({
                projectCode: "PRJ-INACTIVE-VARIANT",
                items: [{ itemId: 50, variantId: 501, quantity: 1 }],
            }, commandActor(7), requestOptions())).rejects.toThrow("ไม่พบรายการย่อยที่พร้อมใช้งาน");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should reject a variant whose item is inactive", async () => {
            prismaMock.stockItemVariant.findMany.mockResolvedValueOnce(
                asNever([{ id: 501, stockItemId: 50, isActive: true, stockItem: { isActive: false } }]),
            );

            await expect(stockService.createRequest({
                projectCode: "PRJ-INACTIVE-ITEM",
                items: [{ itemId: 50, variantId: 501, quantity: 1 }],
            }, commandActor(7), requestOptions())).rejects.toThrow("ไม่พบรายการย่อยที่พร้อมใช้งาน");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should keep using the default variant when only itemId is provided", async () => {
            prismaMock.stockItem.findMany.mockResolvedValue(asNever([{
                id: 50,
                sku: "SKU-50",
                unit: "ชิ้น",
                quantity: 10,
                minStock: 1,
                imageUrl: null,
                isActive: true,
            }]));
            prismaMock.stockItemVariant.findFirst.mockResolvedValue(asNever({ id: 501 }));
            prismaMock.stockItemVariant.findMany.mockResolvedValueOnce(
                asNever([{ id: 501, quantity: 10, unit: "ชิ้น", stockItem: { name: "จอภาพ" } }]),
            );
            prismaMock.stockRequest.create.mockResolvedValue(asNever({
                id: 1,
                projectCode: "PRJ-DEFAULT",
                note: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                requester: { name: "ผู้ใช้ 7", email: "user-7@example.com" },
                items: [],
            }));

            await stockService.createRequest({
                projectCode: "PRJ-DEFAULT",
                items: [{ itemId: 50, quantity: 1 }],
            }, commandActor(7), requestOptions());

            expect(prismaMock.stockRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        items: { create: [{ itemId: 50, variantId: 501, quantity: 1 }] },
                    }),
                }),
            );
        });

        it("should reject when available quantity is lower than requested after pending reserve", async () => {
            prismaMock.stockItemVariant.findMany
                .mockResolvedValueOnce(
                    asNever([{
                        id: 301,
                        stockItemId: 30,
                        isActive: true,
                        stockItem: { isActive: true },
                    }]),
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
                        projectCode: "PRJ-2569/01",
                        items: [{ variantId: 301, quantity: 3 }],
                    },
                    commandActor(7),
                    requestOptions(),
                ),
            ).rejects.toThrow("มีไม่เพียงพอสำหรับเบิก");

            expect(prismaMock.stockRequest.create).not.toHaveBeenCalled();
        });

        it("should create request with normalized item and variant ids when stock is available", async () => {
            prismaMock.stockItemVariant.findMany
                .mockResolvedValueOnce(
                    asNever([{
                        id: 401,
                        stockItemId: 40,
                        isActive: true,
                        stockItem: { isActive: true },
                    }]),
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
                asNever({
                    id: 123,
                    status: "PENDING_ISSUE",
                    projectCode: "PRJ-2569/02",
                    note: "ทดสอบเบิก",
                    createdAt: new Date("2026-01-01T00:00:00.000Z"),
                    requester: { name: "ผู้ใช้ 9", email: "user-9@example.com" },
                    items: [],
                }),
            );

            await stockService.createRequest(
                {
                    projectCode: "PRJ-2569/02",
                    items: [{ variantId: 401, quantity: 3 }],
                    note: "ทดสอบเบิก",
                },
                commandActor(9),
                requestOptions(),
            );

            expect(prismaMock.stockRequest.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        requestedBy: 9,
                        projectCode: "PRJ-2569/02",
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
        it("should not cancel a request that an issue transaction has already claimed", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({ status: "PENDING_ISSUE", requestedBy: 3 }),
            );
            prismaMock.stockRequest.updateMany.mockResolvedValue(
                asNever({ count: 0 }),
            );

            await expect(
                stockService.cancelRequest(55, commandActor(3), "ผู้เบิกไม่มารับ"),
            ).rejects.toThrow("คำขอนี้ถูกดำเนินการแล้ว");

            expect(prismaMock.stockRequest.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 55, status: "PENDING_ISSUE" },
                    data: expect.objectContaining({
                        status: "CANCELLED",
                        cancelReason: "ผู้เบิกไม่มารับ",
                        cancelledById: 3,
                        cancelledAt: expect.any(Date),
                    }),
                }),
            );
            expect(prismaMock.stockRequest.update).not.toHaveBeenCalled();
        });

        it("should cancel only pending issue requests", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({ status: "PENDING_ISSUE", requestedBy: 3 }),
            );

            await stockService.cancelRequest(55, commandActor(3), "ผู้เบิกไม่มารับ");

            expect(prismaMock.stockRequest.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 55, status: "PENDING_ISSUE" },
                    data: expect.objectContaining({
                        status: "CANCELLED",
                        cancelReason: "ผู้เบิกไม่มารับ",
                        cancelledById: 3,
                    }),
                }),
            );
            expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: "STOCK_REQUEST_CANCEL",
                        entityId: 55,
                    }),
                }),
            );
            expect(prismaMock.notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 3,
                        type: "STOCK_CANCELLED",
                    }),
                }),
            );
        });

        it("should reject when non-admin tries to cancel another user's request", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({ status: "PENDING_ISSUE", requestedBy: 8 }),
            );

            await expect(
                stockService.cancelRequest(55, commandActor(3), null, { isAdmin: false }),
            ).rejects.toThrow("ไม่มีสิทธิ์ยกเลิกคำขอนี้");
            expect(prismaMock.stockRequest.update).not.toHaveBeenCalled();
        });
    });

    describe("updateItem", () => {
        it("should reduce an existing variant from 5 to 0 and synchronize the parent", async () => {
            prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue(
                asNever({ id: 24, sku: "SKU-24", unit: "ชิ้น", quantity: 5, minStock: 1, imageUrl: null, isActive: true }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([{ id: 241, sku: "SKU-24-A", imageUrl: null, isActive: true }]),
            );
            prismaMock.stockItem.update
                .mockResolvedValueOnce(asNever({ id: 24, sku: "SKU-24", imageUrl: null }))
                .mockResolvedValueOnce(asNever({ id: 24 }));
            prismaMock.stockItemVariant.aggregate.mockResolvedValue(
                asNever({ _sum: { quantity: 0, minStock: 1 } }),
            );
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({ id: 24, variants: [] }),
            );

            await stockService.updateItem(24, {
                variants: [{ id: 241, expectedQuantity: 5, sku: "SKU-24-A", unit: "ชิ้น", quantity: 0, minStock: 1, attributes: [] }],
            }, 7);

            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ id: 241, quantity: 5 }),
                    data: expect.objectContaining({ quantity: { increment: -5 } }),
                }),
            );
            expect(prismaMock.stockTransaction.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ itemId: 24, variantId: 241, type: "OUT", quantity: -5 }),
            });
            expect(prismaMock.stockItem.update).toHaveBeenNthCalledWith(2, {
                where: { id: 24 },
                data: { quantity: 0, minStock: 1 },
            });
        });

        it("should reject a stale variant update when updateMany changes no rows", async () => {
            prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue(
                asNever({ id: 24, sku: "SKU-24", unit: "ชิ้น", quantity: 5, minStock: 1, imageUrl: null, isActive: true }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([{ id: 241, sku: "SKU-24-A", imageUrl: null, isActive: true }]),
            );
            prismaMock.stockItem.update.mockResolvedValueOnce(
                asNever({ id: 24, sku: "SKU-24", imageUrl: null }),
            );
            prismaMock.stockItemVariant.updateMany.mockResolvedValueOnce(asNever({ count: 0 }));

            await expect(stockService.updateItem(24, {
                variants: [{ id: 241, expectedQuantity: 5, unit: "ชิ้น", quantity: 0, minStock: 1, attributes: [] }],
            }, 7)).rejects.toThrow("ยอดคงเหลือของรายการย่อยเปลี่ยนแปลงแล้ว");

            expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
            expect(prismaMock.stockItemVariant.aggregate).not.toHaveBeenCalled();
        });

        it("should not create a stock transaction when the quantity delta is zero", async () => {
            prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue(
                asNever({ id: 24, sku: "SKU-24", unit: "ชิ้น", quantity: 5, minStock: 1, imageUrl: null, isActive: true }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever([{ id: 241, sku: "SKU-24-A", imageUrl: null, isActive: true }]),
            );
            prismaMock.stockItem.update
                .mockResolvedValueOnce(asNever({ id: 24, sku: "SKU-24", imageUrl: null }))
                .mockResolvedValueOnce(asNever({ id: 24 }));
            prismaMock.stockItem.findUnique.mockResolvedValue(asNever({ id: 24, variants: [] }));

            await stockService.updateItem(24, {
                variants: [{ id: 241, expectedQuantity: 5, unit: "ชิ้น", quantity: 5, minStock: 1, attributes: [] }],
            }, 7);

            expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
        });
        it("should adjust existing variants atomically and synchronize the parent quantity", async () => {
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
            prismaMock.stockItemVariant.aggregate.mockResolvedValue(
                asNever({ _sum: { quantity: 15, minStock: 5 } }),
            );
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
                        expectedQuantity: 10,
                        sku: "SKU-25-A",
                        unit: "ชิ้น",
                        quantity: 8,
                        minStock: 2,
                        attributes: [{ name: "สี", value: "แดง" }],
                    },
                    {
                        id: 252,
                        expectedQuantity: 10,
                        sku: "SKU-25-B",
                        unit: "ชิ้น",
                        quantity: 15,
                        minStock: 3,
                        attributes: [{ name: "สี", value: "น้ำเงิน" }],
                    },
                ],
            }, 7);

            expect(prismaMock.stockItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 25 },
                    data: expect.not.objectContaining({ quantity: expect.any(Number) }),
                }),
            );
            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: expect.objectContaining({ id: 251, quantity: 10 }),
                    data: expect.objectContaining({ quantity: { increment: -2 } }),
                }),
            );
            expect(prismaMock.stockItemVariant.updateMany).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: expect.objectContaining({ id: 252, quantity: 10 }),
                    data: expect.objectContaining({ quantity: { increment: 5 } }),
                }),
            );
            expect(prismaMock.stockTransaction.create).toHaveBeenCalledTimes(2);
            expect(prismaMock.stockItem.update).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: { id: 25 },
                    data: { quantity: 15, minStock: 5 },
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
                        expectedQuantity: 2,
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
            }, 7);

            expect(prismaMock.stockItemVariant.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        stockItemId: 26,
                        quantity: 4,
                        minStock: 2,
                    }),
                }),
            );
            expect(prismaMock.stockTransaction.create).not.toHaveBeenCalled();
            expect(prismaMock.stockItemVariant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 262 },
                    data: { isActive: false },
                }),
            );
        });

        it("should skip inactive variant sku when auto-creating the eleventh variant", async () => {
            const existingVariants = Array.from({ length: 11 }, (_, index) => ({
                id: 270 + index,
                sku: `SKU-27-V${index + 1}`,
                imageUrl: null,
                isActive: index < 10,
            }));
            const submittedVariants = existingVariants
                .slice(0, 10)
                .map((variant) => ({
                    id: variant.id,
                    expectedQuantity: 1,
                    sku: variant.sku,
                    unit: "ชิ้น",
                    quantity: 1,
                    minStock: 1,
                    attributes: [{ name: "ลำดับ", value: String(variant.id) }],
                }));

            prismaMock.stockItem.findUniqueOrThrow.mockResolvedValue(
                asNever({
                    id: 27,
                    sku: "SKU-27",
                    unit: "ชิ้น",
                    quantity: 10,
                    minStock: 1,
                    imageUrl: null,
                    isActive: true,
                }),
            );
            prismaMock.stockItemVariant.findMany.mockResolvedValue(
                asNever(existingVariants),
            );
            prismaMock.stockItem.update
                .mockResolvedValueOnce(
                    asNever({
                        id: 27,
                        sku: "SKU-27",
                        imageUrl: null,
                    }),
                )
                .mockResolvedValueOnce(asNever({ id: 27 }));
            prismaMock.stockItemVariant.update.mockResolvedValue(asNever({ id: 270 }));
            prismaMock.stockItemVariant.create.mockResolvedValueOnce(
                asNever({ id: 281 }),
            );
            prismaMock.stockVariantAttributeValue.deleteMany.mockResolvedValue(
                asNever({ count: 1 }),
            );
            prismaMock.stockAttribute.upsert.mockResolvedValue(asNever({ id: 1 }));
            prismaMock.stockAttributeValue.upsert.mockResolvedValue(
                asNever({ id: 11 }),
            );
            prismaMock.stockVariantAttributeValue.create.mockResolvedValue(
                asNever({ variantId: 281, attributeValueId: 11 }),
            );
            prismaMock.stockTransaction.findFirst.mockResolvedValue(
                asNever({ id: 1 }),
            );
            prismaMock.stockRequestItem.findFirst.mockResolvedValue(null as never);
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({ id: 27, variants: [] }),
            );

            await stockService.updateItem(27, {
                variants: [
                    ...submittedVariants,
                    {
                        unit: "ชิ้น",
                        quantity: 1,
                        minStock: 1,
                        attributes: [{ name: "ลำดับ", value: "ใหม่" }],
                    },
                ],
            }, 7);

            expect(prismaMock.stockItemVariant.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        stockItemId: 27,
                        sku: "SKU-27-V12",
                    }),
                }),
            );
        });
    });
});
