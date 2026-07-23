import {
    Prisma,
    PrismaClient,
    StockRequestStatus,
    StockTxType,
} from "@prisma/client";
import type { StockItem, StockItemVariant } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { stockService } from "@/lib/services/stock";
import { lockStockInventoryRows } from "@/lib/services/stock/locks";
import {
    createRollbackTrigger,
    dropRollbackTrigger,
} from "./mysql-trigger";
import {
    cleanIntegrationDatabase,
    createStockFixture,
    type StockFixture,
} from "./stock-fixtures";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function readInventory(
    fixture: StockFixture,
): Promise<{ item: StockItem; variant: StockItemVariant }> {
    const [item, variant] = await Promise.all([
        prisma.stockItem.findUniqueOrThrow({ where: { id: fixture.item.id } }),
        prisma.stockItemVariant.findUniqueOrThrow({ where: { id: fixture.variant.id } }),
    ]);
    return { item, variant };
}

describe.sequential("stock mutations with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await dropRollbackTrigger();
        await cleanIntegrationDatabase(prisma);
    });

    afterAll(async () => {
        await dropRollbackTrigger();
        await cleanIntegrationDatabase(prisma);
        await prisma.$disconnect();
    });

    it("ใช้ Serializable จริง และ FOR UPDATE กันคำสั่งแก้สต็อกจนกว่าจะปล่อย lock", async () => {
        const fixture = await createStockFixture(prisma);
        const holder = new PrismaClient();
        let releaseLock: (() => void) | undefined;
        let signalLocked: (() => void) | undefined;
        const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
        const release = new Promise<void>((resolve) => { releaseLock = resolve; });

        const holdingTransaction = holder.$transaction(async (tx) => {
            await lockStockInventoryRows(tx, [fixture.item.id]);
            signalLocked?.();
            await release;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        await locked;
        let finishSerializableRead: (() => void) | undefined;

        try {
            let adjustmentSettled = false;
            const adjustment = stockService.adjustStock(
                fixture.item.id,
                {
                    variantId: fixture.variant.id,
                    type: StockTxType.IN,
                    quantity: 1,
                    minStock: fixture.minStock,
                },
                fixture.issuerActor,
            ).finally(() => { adjustmentSettled = true; });
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(adjustmentSettled).toBe(false);

            releaseLock?.();
            await Promise.all([holdingTransaction, adjustment]);

            let signalRangeRead: (() => void) | undefined;
            const rangeRead = new Promise<void>((resolve) => {
                signalRangeRead = resolve;
            });
            const finishRead = new Promise<void>((resolve) => {
                finishSerializableRead = resolve;
            });
            const serializableRead = runSerializableTransaction(async (tx) => {
                await tx.stockItem.count({
                    where: { categoryId: fixture.category.id },
                });
                signalRangeRead?.();
                await finishRead;
            });
            await rangeRead;

            let insertSettled = false;
            const matchingInsert = holder.stockItem.create({
                data: {
                    name: "วัสดุตรวจ Serializable",
                    sku: "SERIALIZABLE-RANGE-LOCK",
                    unit: "ชิ้น",
                    quantity: 1,
                    minStock: 1,
                    categoryId: fixture.category.id,
                },
            }).finally(() => { insertSettled = true; });
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(insertSettled).toBe(false);

            finishSerializableRead?.();
            await Promise.all([serializableRead, matchingInsert]);
        } finally {
            releaseLock?.();
            finishSerializableRead?.();
            await holdingTransaction.catch(() => undefined);
            await holder.$disconnect();
        }
    });

    it("Issue พร้อมกันสองคำขอจ่ายสต็อกเพียงครั้งเดียว", async () => {
        const fixture = await createStockFixture(prisma);
        const results = await Promise.allSettled([
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
        ]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

        const inventory = await readInventory(fixture);
        expect(inventory.item.quantity).toBe(7);
        expect(inventory.variant.quantity).toBe(7);
        expect(await prisma.stockTransaction.count()).toBe(1);
        expect(await prisma.auditLog.count()).toBe(1);
        expect(await prisma.notification.count()).toBe(1);
    });

    it("Issue ชนกับ Adjust แล้วไม่ทำยอดสูญหาย", async () => {
        const fixture = await createStockFixture(prisma);
        await Promise.all([
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
            stockService.adjustStock(
                fixture.item.id,
                {
                    variantId: fixture.variant.id,
                    type: StockTxType.IN,
                    quantity: 5,
                    minStock: fixture.minStock,
                },
                fixture.issuerActor,
            ),
        ]);

        const inventory = await readInventory(fixture);
        expect(inventory.item.quantity).toBe(12);
        expect(inventory.variant.quantity).toBe(12);
        expect(await prisma.stockTransaction.count()).toBe(2);
        expect(await prisma.auditLog.count()).toBe(2);
    });

    it("Issue ชนกับ Update Item แล้วผลลัพธ์ไม่มี lost update", async () => {
        const fixture = await createStockFixture(prisma);
        const results = await Promise.allSettled([
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
            stockService.updateItem(
                fixture.item.id,
                {
                    variants: [{
                        id: fixture.variant.id,
                        expectedQuantity: 10,
                        quantity: 14,
                        minStock: fixture.minStock,
                        unit: "ชิ้น",
                        attributes: [],
                    }],
                },
                fixture.issuerActor,
            ),
        ]);
        expect(results[0]?.status).toBe("fulfilled");

        const updateSucceeded = results[1]?.status === "fulfilled";
        const inventory = await readInventory(fixture);
        expect(inventory.item.quantity).toBe(updateSucceeded ? 11 : 7);
        expect(inventory.variant.quantity).toBe(inventory.item.quantity);
        expect(await prisma.stockTransaction.count()).toBe(updateSucceeded ? 2 : 1);
    });

    it("Update Item สองคำสั่งพร้อมกันยอมรับ stale quantity เพียงคำสั่งเดียว", async () => {
        const fixture = await createStockFixture(prisma);
        const update = (
            quantity: number,
        ): ReturnType<typeof stockService.updateItem> => stockService.updateItem(
            fixture.item.id,
            {
                variants: [{
                    id: fixture.variant.id,
                    expectedQuantity: 10,
                    quantity,
                    minStock: fixture.minStock,
                    unit: "ชิ้น",
                    attributes: [],
                }],
            },
            fixture.issuerActor,
        );
        const results = await Promise.allSettled([update(12), update(15)]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

        const inventory = await readInventory(fixture);
        expect([12, 15]).toContain(inventory.item.quantity);
        expect(inventory.variant.quantity).toBe(inventory.item.quantity);
        expect(await prisma.stockTransaction.count()).toBe(1);
    });

    it("retry transaction ที่ MySQL เลือกเป็น deadlock victim จริง", async () => {
        const first = await createStockFixture(prisma, { suffix: "A" });
        const second = await createStockFixture(prisma, { suffix: "B" });
        let arrivals = 0;
        let openBarrier: (() => void) | undefined;
        const barrier = new Promise<void>((resolve) => { openBarrier = resolve; });
        const attempts = [0, 0];

        const worker = (
            index: number,
            firstId: number,
            secondId: number,
        ): Promise<void> =>
            runSerializableTransaction(async (tx) => {
                attempts[index] += 1;
                await tx.stockItem.update({
                    where: { id: firstId },
                    data: { minStock: { increment: 1 } },
                });
                if (attempts[index] === 1) {
                    arrivals += 1;
                    if (arrivals === 2) openBarrier?.();
                    await barrier;
                }
                await tx.stockItem.update({
                    where: { id: secondId },
                    data: { minStock: { increment: 1 } },
                });
            });

        await Promise.all([
            worker(0, first.item.id, second.item.id),
            worker(1, second.item.id, first.item.id),
        ]);
        expect(attempts[0] + attempts[1]).toBe(3);
        const rows = await prisma.stockItem.findMany({
            where: { id: { in: [first.item.id, second.item.id] } },
            orderBy: { id: "asc" },
        });
        expect(rows.map((row) => row.minStock)).toEqual([4, 4]);
    });

    it("rollback domain, ledger, audit และ notification เมื่อ notification ล้ม", async () => {
        const fixture = await createStockFixture(prisma);
        await createRollbackTrigger();

        try {
            await expect(
                stockService.issueRequest(fixture.request.id, fixture.issuerActor),
            ).rejects.toBeDefined();
        } finally {
            await dropRollbackTrigger();
        }

        const inventory = await readInventory(fixture);
        const request = await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        });
        expect(request.status).toBe(StockRequestStatus.PENDING_ISSUE);
        expect(inventory.item.quantity).toBe(10);
        expect(inventory.variant.quantity).toBe(10);
        expect(await prisma.stockTransaction.count()).toBe(0);
        expect(await prisma.auditLog.count()).toBe(0);
        expect(await prisma.notification.count()).toBe(0);
    });
});
