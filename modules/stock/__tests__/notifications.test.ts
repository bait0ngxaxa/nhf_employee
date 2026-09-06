import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import {
    enqueueLineLowStockReached,
    enqueueLineNewStockRequest,
    notifyAdminsNewStockRequest,
    notifyAdminsStockRequestCancelledByRequester,
    notifyAdminsLowStockInApp,
    notifyStockRequestResult,
} from "../infrastructure/notifications/notifications";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const notificationMocks = vi.hoisted(() => ({
    createForUser: vi.fn(),
    createForUserOnce: vi.fn(),
    createForUsers: vi.fn(),
}));

vi.mock("@/modules/notification", () => notificationMocks);

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
        vi.clearAllMocks();
        notificationMocks.createForUser.mockResolvedValue(undefined);
        notificationMocks.createForUserOnce.mockResolvedValue(undefined);
        notificationMocks.createForUsers.mockResolvedValue(0);
    });

    it("should enqueue stock request line payload with projectCode and variant label", async () => {
        await enqueueLineNewStockRequest({
            id: 123,
            projectCode: "PRJ-2569/01",
            note: "ด่วน",
            createdAt: new Date("2026-03-30T07:00:00.000Z"),
            requester: {
                name: "ชื่อเดิม",
                email: "somchai@example.com",
                employee: {
                    firstName: "สมชาย",
                    lastName: "ใจดี",
                    nickname: "ชาย",
                },
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
        expect(payload.requesterName).toBe("สมชาย ใจดี (ชาย)");
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

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
            where: {
                role: "ADMIN",
                isActive: true,
                deletedAt: null,
            },
            select: { id: true },
        });
        expect(notificationMocks.createForUserOnce).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 7,
                message: "วัสดุ 1 รายการถึงหรือต่ำกว่าจุดแจ้งเตือน: หมึกพิมพ์ (สี: ดำ) (1/5 ตลับ)",
                referenceId: "INK-BLACK",
            }),
            prismaMock,
        );
    });

    it("keeps new-request admin eligibility and user-specific dedupe keys in Stock", async () => {
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 7 }, { id: 8 }]));

        await notifyAdminsNewStockRequest(42, "สมชาย", "PRJ-42", prismaMock);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
            where: {
                role: "ADMIN",
                isActive: true,
                deletedAt: null,
            },
            select: { id: true },
        });
        expect(notificationMocks.createForUserOnce).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                userId: 7,
                dedupeKey: "stock:42:STOCK_REQUEST_NEW:7",
            }),
            prismaMock,
        );
        expect(notificationMocks.createForUserOnce).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                userId: 8,
                dedupeKey: "stock:42:STOCK_REQUEST_NEW:8",
            }),
            prismaMock,
        );
    });

    it("keeps requester-cancellation admin eligibility and strict batch semantics", async () => {
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 7 }, { id: 8 }]));

        await notifyAdminsStockRequestCancelledByRequester(42, "สมชาย", prismaMock);

        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
            where: { role: "ADMIN" },
            select: { id: true },
        });
        expect(notificationMocks.createForUsers).toHaveBeenCalledWith(
            [
                expect.objectContaining({ userId: 7, type: "STOCK_CANCELLED" }),
                expect.objectContaining({ userId: 8, type: "STOCK_CANCELLED" }),
            ],
            prismaMock,
        );
        const inputs = notificationMocks.createForUsers.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
        expect(inputs.every((input) => !Object.prototype.hasOwnProperty.call(input, "dedupeKey"))).toBe(true);
    });

    it("keeps requester result notifications strict and without a dedupe key", async () => {
        await notifyStockRequestResult(42, 7, false, "ผู้เบิกไม่มารับ", prismaMock);

        expect(notificationMocks.createForUser).toHaveBeenCalledWith(
            {
                userId: 7,
                type: "STOCK_CANCELLED",
                title: "คำขอเบิกวัสดุถูกยกเลิก",
                message: "คำขอเบิก #42 ถูกยกเลิก: ผู้เบิกไม่มารับ",
                actionUrl: "/dashboard/stock?stockTab=my-requests",
                referenceId: "42",
            },
            prismaMock,
        );
    });
});
