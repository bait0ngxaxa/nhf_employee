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
    });

    describe("approveRequest", () => {
        it("should reject when aggregated duplicate items exceed stock", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    id: 77,
                    status: "PENDING",
                    items: [
                        { itemId: 10, quantity: 3 },
                        { itemId: 10, quantity: 3 },
                    ],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    { id: 10, name: "ปากกา", unit: "ด้าม", quantity: 5 },
                ]),
            );

            await expect(stockService.approveRequest(77, 5)).rejects.toThrow(
                "มีไม่เพียงพอ",
            );
            expect(prismaMock.stockItem.updateMany).not.toHaveBeenCalled();
        });

        it("should guard race condition when conditional update cannot decrement", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    id: 88,
                    status: "PENDING",
                    items: [{ itemId: 11, quantity: 2 }],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    { id: 11, name: "กระดาษ", unit: "รีม", quantity: 10 },
                ]),
            );
            prismaMock.stockItem.updateMany.mockResolvedValue(
                asNever({ count: 0 }),
            );
            prismaMock.stockItem.findUnique.mockResolvedValue(
                asNever({ name: "กระดาษ", unit: "รีม", quantity: 1 }),
            );

            await expect(stockService.approveRequest(88, 9)).rejects.toThrow(
                "มีไม่เพียงพอ",
            );
            expect(prismaMock.stockItem.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: 11,
                        quantity: { gte: 2 },
                    }),
                }),
            );
        });

        it("should decrement by aggregated quantity once per item", async () => {
            prismaMock.stockRequest.findUnique.mockResolvedValue(
                asNever({
                    id: 99,
                    status: "PENDING",
                    items: [
                        { itemId: 10, quantity: 2 },
                        { itemId: 10, quantity: 3 },
                        { itemId: 12, quantity: 1 },
                    ],
                }),
            );
            prismaMock.stockItem.findMany.mockResolvedValue(
                asNever([
                    { id: 10, name: "ปากกา", unit: "ด้าม", quantity: 20 },
                    { id: 12, name: "สมุด", unit: "เล่ม", quantity: 7 },
                ]),
            );
            prismaMock.stockItem.updateMany.mockResolvedValue(
                asNever({ count: 1 }),
            );
            prismaMock.stockTransaction.create.mockResolvedValue(
                asNever({ id: 1 }),
            );
            prismaMock.stockRequest.update.mockResolvedValue(
                asNever({ id: 99, status: "APPROVED" }),
            );

            await stockService.approveRequest(99, 9);

            expect(prismaMock.stockItem.updateMany).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: { id: 10, quantity: { gte: 5 } },
                    data: { quantity: { decrement: 5 } },
                }),
            );
            expect(prismaMock.stockItem.updateMany).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: { id: 12, quantity: { gte: 1 } },
                    data: { quantity: { decrement: 1 } },
                }),
            );
        });
    });
});
