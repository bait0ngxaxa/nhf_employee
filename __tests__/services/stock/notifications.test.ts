import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import {
    enqueueLineLowStockReached,
    enqueueLineNewStockRequest,
    notifyAdminsLowStockInApp,
} from "@/lib/services/stock/notifications";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("Stock Notifications", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.notificationOutbox.create.mockResolvedValue(
            asNever({
                id: 1,
                type: "STOCK_REQUEST_LINE",
                payload: "{}",
                status: "PENDING",
                attempts: 0,
                error: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        );
    });

    it("should enqueue stock request line payload with projectCode and variant label", async () => {
        await enqueueLineNewStockRequest({
            id: 123,
            projectCode: "PRJ-2569/01",
            note: "ด่วน",
            createdAt: new Date("2026-03-30T07:00:00.000Z"),
            requester: {
                name: "สมชาย",
                email: "somchai@example.com",
            },
            items: [
                {
                    quantity: 2,
                    item: {
                        name: "กระดาษ",
                        unit: "รีม",
                    },
                    variant: {
                        unit: "รีม",
                        attributeValues: [
                            {
                                attributeValue: {
                                    value: "A4",
                                    attribute: {
                                        name: "ขนาด",
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
        });

        expect(prismaMock.notificationOutbox.create).toHaveBeenCalledTimes(1);
        const createCall = prismaMock.notificationOutbox.create.mock.calls[0]?.[0];
        const payload = JSON.parse(createCall?.data.payload ?? "{}") as {
            projectCode: string;
            requesterName: string;
            itemCount: number;
            totalQuantity: number;
            items: Array<{ variantLabel?: string }>;
        };

        expect(createCall?.data.type).toBe("STOCK_REQUEST_LINE");
        expect(payload.projectCode).toBe("PRJ-2569/01");
        expect(payload.requesterName).toBe("สมชาย");
        expect(payload.itemCount).toBe(1);
        expect(payload.totalQuantity).toBe(2);
        expect(payload.items[0]?.variantLabel).toBe("ขนาด: A4");
    });

    it("should enqueue low stock line payload with all affected items", async () => {
        await enqueueLineLowStockReached([
            {
                itemId: 10,
                name: "ปากกา",
                sku: "PEN-001",
                quantity: 3,
                minStock: 5,
                unit: "ด้าม",
            },
            {
                itemId: 11,
                name: "กระดาษ",
                sku: "PAPER-001",
                quantity: 4,
                minStock: 4,
                unit: "รีม",
            },
        ]);

        expect(prismaMock.notificationOutbox.create).toHaveBeenCalledTimes(1);
        const createCall = prismaMock.notificationOutbox.create.mock.calls[0]?.[0];
        const payload = JSON.parse(createCall?.data.payload ?? "{}") as {
            itemCount: number;
            items: Array<{ sku: string }>;
        };

        expect(createCall?.data.type).toBe("STOCK_LOW_LINE");
        expect(payload.itemCount).toBe(2);
        expect(payload.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ sku: "PEN-001" }),
                expect.objectContaining({ sku: "PAPER-001" }),
            ]),
        );
    });

    it("should preserve variant identity in low stock line payload", async () => {
        await enqueueLineLowStockReached([{
            itemId: 10,
            variantId: 101,
            itemName: "หมึกพิมพ์",
            variantSku: "INK-BLACK",
            variantLabel: "สี: ดำ",
            quantity: 1,
            minStock: 5,
            unit: "ตลับ",
        }]);

        const createCall = prismaMock.notificationOutbox.create.mock.calls[0]?.[0];
        const payload = JSON.parse(createCall?.data.payload ?? "{}") as {
            items: Array<Record<string, unknown>>;
        };

        expect(payload.items[0]).toEqual(expect.objectContaining({
            variantId: 101,
            itemName: "หมึกพิมพ์",
            variantSku: "INK-BLACK",
            variantLabel: "สี: ดำ",
        }));
    });

    it("should include variant identity in the in-app low stock message", async () => {
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 7 }]));
        prismaMock.notification.create.mockResolvedValue(asNever({ id: "notice-1" }));

        await notifyAdminsLowStockInApp({
            alertedAt: "2026-07-22T03:00:00.000Z",
            itemCount: 1,
            items: [{
                itemId: 10,
                variantId: 101,
                itemName: "หมึกพิมพ์",
                variantSku: "INK-BLACK",
                variantLabel: "สี: ดำ",
                quantity: 1,
                minStock: 5,
                unit: "ตลับ",
            }],
        });

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                message: "วัสดุ 1 รายการถึงหรือต่ำกว่าจุดแจ้งเตือน: หมึกพิมพ์ (สี: ดำ) (1/5 ตลับ)",
                referenceId: "INK-BLACK",
            }),
        });
    });
});
