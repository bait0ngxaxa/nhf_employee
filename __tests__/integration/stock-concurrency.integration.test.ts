import {
    Prisma,
    PrismaClient,
    StockReferenceType,
    StockRequestStatus,
    StockTxType,
} from "@prisma/client";
import type { StockItem, StockItemVariant } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { stockService } from "@/lib/services/stock";
import {
    applyDefaultVariantBackfill,
    loadDefaultVariantBackfillReport,
} from "@/lib/services/stock/default-variant-backfill";
import {
    InvalidStockDefaultVariantError,
    setStockItemDefaultVariantIfUnset,
} from "@/lib/services/stock/default-variant-writer";
import { lockStockInventoryRows } from "@/lib/services/stock/locks";
import { createStockOpeningBalanceTransaction } from "@/lib/services/stock/write-helpers";
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

    it("สร้างวัสดุหนึ่ง variant พร้อม parent aggregate และ opening balance", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "CREATE-ONE" });
        const created = await stockService.createItem({
            name: "ปากกาสำหรับทดสอบการสร้าง",
            sku: "CREATE-ONE-ITEM",
            categoryId: fixture.category.id,
            variants: [{
                sku: "CREATE-ONE-VARIANT",
                unit: "ด้าม",
                quantity: 6,
                minStock: 2,
                attributes: [],
            }],
        }, fixture.issuerActor);

        expect(created.quantity).toBe(6);
        expect(created.minStock).toBe(2);
        expect(created.variants).toHaveLength(1);
        expect(created.variants[0]).toMatchObject({
            sku: "CREATE-ONE-VARIANT",
            quantity: 6,
            minStock: 2,
        });

        const variantId = created.variants[0].id;
        const openingBalance = await prisma.stockTransaction.findUniqueOrThrow({
            where: { openingBalanceKey: `stock-variant:${variantId}` },
        });
        expect(openingBalance).toMatchObject({
            itemId: created.id,
            variantId,
            type: StockTxType.OPENING_BALANCE,
            quantity: 6,
        });

    });

    it("openingBalanceKey ป้องกัน helper สร้าง opening balance ซ้ำ", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "OPENING-KEY" });

        await prisma.$transaction(async (tx) => {
            await createStockOpeningBalanceTransaction(
                tx,
                fixture.item.id,
                fixture.variant.id,
                fixture.quantity,
                fixture.issuer.id,
            );
            await createStockOpeningBalanceTransaction(
                tx,
                fixture.item.id,
                fixture.variant.id,
                fixture.quantity,
                fixture.issuer.id,
            );
        });
        expect(await prisma.stockTransaction.count({
            where: {
                openingBalanceKey: `stock-variant:${fixture.variant.id}`,
            },
        })).toBe(1);
    });

    it("default variant dry-run รายงาน candidate โดยไม่เขียนข้อมูล", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "DEFAULT-DRY" });

        const report = await loadDefaultVariantBackfillReport();

        expect(report.details).toContainEqual(expect.objectContaining({
            itemId: fixture.item.id,
            legacyDefaultVariantId: fixture.variant.id,
            explicitDefaultVariantId: null,
            classification: "READY_FOR_BACKFILL",
        }));
        expect((await prisma.stockItem.findUniqueOrThrow({
            where: { id: fixture.item.id },
            select: { defaultVariantId: true },
        })).defaultVariantId).toBeNull();
    });

    it("explicit default writer บังคับ same-item active variant", async () => {
        const first = await createStockFixture(prisma, {
            suffix: "DEFAULT-OWNER-A",
        });
        const second = await createStockFixture(prisma, {
            suffix: "DEFAULT-OWNER-B",
        });

        await expect(prisma.$transaction((tx) =>
            setStockItemDefaultVariantIfUnset(
                tx,
                first.item.id,
                second.variant.id,
            ),
        )).rejects.toBeInstanceOf(InvalidStockDefaultVariantError);

        expect((await prisma.stockItem.findUniqueOrThrow({
            where: { id: first.item.id },
            select: { defaultVariantId: true },
        })).defaultVariantId).toBeNull();

        await prisma.stockItemVariant.update({
            where: { id: first.variant.id },
            data: { isActive: false },
        });
        await expect(prisma.$transaction((tx) =>
            setStockItemDefaultVariantIfUnset(
                tx,
                first.item.id,
                first.variant.id,
            ),
        )).rejects.toBeInstanceOf(InvalidStockDefaultVariantError);

        await prisma.stockItemVariant.update({
            where: { id: first.variant.id },
            data: { isActive: true },
        });
        await expect(prisma.$transaction((tx) =>
            setStockItemDefaultVariantIfUnset(
                tx,
                first.item.id,
                first.variant.id,
            ),
        )).resolves.toBe(true);
        expect((await prisma.stockItem.findUniqueOrThrow({
            where: { id: first.item.id },
            select: { defaultVariantId: true },
        })).defaultVariantId).toBe(first.variant.id);
    });

    it("default variant apply เลือก lowest active ID และรันซ้ำได้โดยไม่ overwrite", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "DEFAULT-APPLY" });
        const laterVariant = await prisma.stockItemVariant.create({
            data: {
                stockItemId: fixture.item.id,
                sku: "DEFAULT-APPLY-LATER",
                unit: "ชิ้น",
                quantity: 4,
                minStock: 1,
            },
        });
        const before = await loadDefaultVariantBackfillReport();

        const firstApply = await applyDefaultVariantBackfill(
            before.candidateItemIds,
        );
        const secondApply = await applyDefaultVariantBackfill([
            fixture.item.id,
        ]);

        expect(firstApply.updatedItemIds).toContain(fixture.item.id);
        expect(secondApply).toMatchObject({
            attempted: 1,
            updated: 0,
            skipped: 1,
        });
        expect((await prisma.stockItem.findUniqueOrThrow({
            where: { id: fixture.item.id },
            select: { defaultVariantId: true },
        })).defaultVariantId).toBe(fixture.variant.id);

        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { defaultVariantId: laterVariant.id },
        });
        const mismatch = await loadDefaultVariantBackfillReport();
        const detail = mismatch.details.find(
            (entry) => entry.itemId === fixture.item.id,
        );
        expect(detail).toMatchObject({
            legacyDefaultVariantId: fixture.variant.id,
            explicitDefaultVariantId: laterVariant.id,
            classification: "SHADOW_MISMATCH",
        });
        expect(mismatch.candidateItemIds).not.toContain(fixture.item.id);

        const otherItem = await prisma.stockItem.create({
            data: {
                name: "วัสดุ default คนละ item",
                sku: "DEFAULT-APPLY-OTHER",
                unit: "ชิ้น",
                quantity: 1,
                minStock: 1,
                categoryId: fixture.category.id,
            },
        });
        const otherVariant = await prisma.stockItemVariant.create({
            data: {
                stockItemId: otherItem.id,
                sku: "DEFAULT-APPLY-OTHER-VARIANT",
                unit: "ชิ้น",
                quantity: 1,
                minStock: 1,
            },
        });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { defaultVariantId: otherVariant.id },
        });
        const crossItemReport = await loadDefaultVariantBackfillReport();
        expect(crossItemReport.details.find(
            (entry) => entry.itemId === fixture.item.id,
        )).toMatchObject({
            explicitDefaultVariantId: otherVariant.id,
            explicitDefaultVariantStockItemId: otherItem.id,
            classification: "CROSS_ITEM_DEFAULT",
        });
    });

    it("สร้างวัสดุหลาย variant พร้อม aggregate, ledger ราย variant และ SKU uniqueness", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "CREATE-MULTI" });
        const created = await stockService.createItem({
            name: "หมึกพิมพ์หลายสี",
            sku: "CREATE-MULTI-ITEM",
            categoryId: fixture.category.id,
            variants: [
                {
                    sku: "CREATE-MULTI-BLACK",
                    unit: "ตลับ",
                    quantity: 4,
                    minStock: 1,
                    attributes: [{ name: "สี", value: "ดำ" }],
                },
                {
                    sku: "CREATE-MULTI-CYAN",
                    unit: "ตลับ",
                    quantity: 7,
                    minStock: 2,
                    attributes: [{ name: "สี", value: "ฟ้า" }],
                },
            ],
        }, fixture.issuerActor);

        expect(created.quantity).toBe(11);
        expect(created.minStock).toBe(3);
        expect(created.variants.map((variant) => ({
            sku: variant.sku,
            quantity: variant.quantity,
        }))).toEqual([
            { sku: "CREATE-MULTI-BLACK", quantity: 4 },
            { sku: "CREATE-MULTI-CYAN", quantity: 7 },
        ]);
        expect(await prisma.stockTransaction.findMany({
            where: { itemId: created.id, type: StockTxType.OPENING_BALANCE },
            orderBy: { variantId: "asc" },
            select: { variantId: true, quantity: true },
        })).toEqual(created.variants.map((variant) => ({
            variantId: variant.id,
            quantity: variant.quantity,
        })));

        await expect(stockService.createItem({
            name: "วัสดุ SKU ซ้ำ",
            sku: "CREATE-MULTI-DUPLICATE-PARENT",
            categoryId: fixture.category.id,
            variants: [{
                sku: "CREATE-MULTI-BLACK",
                unit: "ตลับ",
                quantity: 1,
                minStock: 1,
                attributes: [],
            }],
        }, fixture.issuerActor)).rejects.toBeDefined();
        expect(await prisma.stockItem.count({
            where: { sku: "CREATE-MULTI-DUPLICATE-PARENT" },
        })).toBe(0);
    });

    it("จ่ายคำขอแล้วลด parent และ variant พร้อมบันทึก ledger, audit และ outbox", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "ISSUE-FLOW",
            minStock: 8,
        });

        const result = await stockService.issueRequest(
            fixture.request.id,
            fixture.issuerActor,
        );
        const inventory = await readInventory(fixture);
        const request = await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        });
        const requestItem = await prisma.stockRequestItem.findFirstOrThrow({
            where: { requestId: fixture.request.id },
        });
        const transaction = await prisma.stockTransaction.findFirstOrThrow({
            where: { stockRequestId: fixture.request.id },
        });

        expect(result.request).toEqual({
            id: fixture.request.id,
            requestedBy: fixture.requester.id,
        });
        expect(request.status).toBe(StockRequestStatus.ISSUED);
        expect(inventory.item.quantity).toBe(7);
        expect(inventory.variant.quantity).toBe(7);
        expect(transaction).toMatchObject({
            itemId: fixture.item.id,
            variantId: fixture.variant.id,
            type: StockTxType.OUT,
            quantity: -fixture.requestedQuantity,
            stockRequestId: fixture.request.id,
            stockRequestItemId: requestItem.id,
            referenceType: StockReferenceType.STOCK_REQUEST,
            referenceId: String(fixture.request.id),
        });
        expect(await prisma.auditLog.count({
            where: { action: "STOCK_REQUEST_ISSUE", entityId: fixture.request.id },
        })).toBe(1);
        expect(await prisma.notificationOutbox.count({
            where: { type: "STOCK_LOW_LINE" },
        })).toBe(1);
    });

    it("ไม่เปลี่ยน inventory, ledger หรือ request เมื่อ stock ไม่เพียงพอ", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "INSUFFICIENT",
            requestedQuantity: 11,
        });

        await expect(
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
        ).rejects.toThrow("มีไม่เพียงพอ");

        const inventory = await readInventory(fixture);
        const request = await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        });
        expect(inventory.item.quantity).toBe(10);
        expect(inventory.variant.quantity).toBe(10);
        expect(request.status).toBe(StockRequestStatus.PENDING_ISSUE);
        expect(await prisma.stockTransaction.count({
            where: { stockRequestId: fixture.request.id, type: StockTxType.OUT },
        })).toBe(0);
    });

    it("ไม่จ่ายคำขอเมื่อ variant ปิดใช้งาน", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "INACTIVE-VARIANT" });
        await prisma.stockItemVariant.update({
            where: { id: fixture.variant.id },
            data: { isActive: false },
        });

        await expect(
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
        ).rejects.toThrow("ปิดใช้งานแล้ว");
        expect((await readInventory(fixture)).item.quantity).toBe(10);
        expect((await readInventory(fixture)).variant.quantity).toBe(10);
        expect((await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        })).status).toBe(StockRequestStatus.PENDING_ISSUE);
    });

    it("ไม่จ่ายคำขอเมื่อ parent item ปิดใช้งานแม้ variant ยัง active", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "INACTIVE-PARENT" });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { isActive: false },
        });

        await expect(
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
        ).rejects.toThrow("ปิดใช้งานแล้ว");
        const inventory = await readInventory(fixture);
        expect(inventory.item.quantity).toBe(10);
        expect(inventory.variant.quantity).toBe(10);
        expect((await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        })).status).toBe(StockRequestStatus.PENDING_ISSUE);
    });

    it("legacy request ที่ไม่มี variant ใช้ active variant ID ต่ำที่สุด", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "LEGACY-DEFAULT" });
        const laterVariant = await prisma.stockItemVariant.create({
            data: {
                stockItemId: fixture.item.id,
                sku: "LEGACY-DEFAULT-LATER",
                unit: "ชิ้น",
                quantity: 20,
                minStock: 2,
            },
        });
        await prisma.stockRequestItem.updateMany({
            where: { requestId: fixture.request.id },
            data: { variantId: null },
        });

        // Characterization only: Phase 1 preserves the legacy lowest-active-ID fallback.
        await stockService.issueRequest(fixture.request.id, fixture.issuerActor);

        const transaction = await prisma.stockTransaction.findFirstOrThrow({
            where: { stockRequestId: fixture.request.id },
        });
        expect(transaction.variantId).toBe(fixture.variant.id);
        expect((await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: fixture.variant.id },
        })).quantity).toBe(7);
        expect((await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: laterVariant.id },
        })).quantity).toBe(20);
    });

    it("ปฏิเสธ request item ที่อ้าง variant ของอีก item ภายใน issue transaction", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "CROSS-ITEM" });
        const otherItem = await prisma.stockItem.create({
            data: {
                name: "วัสดุอีกชิ้น",
                sku: "CROSS-ITEM-OTHER",
                unit: "ชิ้น",
                quantity: 5,
                minStock: 1,
                categoryId: fixture.category.id,
            },
        });
        const otherVariant = await prisma.stockItemVariant.create({
            data: {
                stockItemId: otherItem.id,
                sku: "CROSS-ITEM-OTHER-VARIANT",
                unit: "ชิ้น",
                quantity: 5,
                minStock: 1,
            },
        });
        await prisma.stockRequestItem.updateMany({
            where: { requestId: fixture.request.id },
            data: { variantId: otherVariant.id },
        });

        await expect(
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
        ).rejects.toThrow("ปิดใช้งานแล้ว");

        expect((await readInventory(fixture)).item.quantity).toBe(10);
        expect((await prisma.stockItem.findUniqueOrThrow({
            where: { id: otherItem.id },
        })).quantity).toBe(5);
        expect((await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        })).status).toBe(StockRequestStatus.PENDING_ISSUE);
        expect(await prisma.stockTransaction.count({
            where: { stockRequestId: fixture.request.id },
        })).toBe(0);
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
        const requestItem = await prisma.stockRequestItem.findFirstOrThrow({
            where: { requestId: fixture.request.id },
            select: { id: true },
        });
        const transaction = await prisma.stockTransaction.findFirstOrThrow({
            where: { stockRequestId: fixture.request.id },
            select: {
                stockRequestId: true,
                stockRequestItemId: true,
                referenceType: true,
                referenceId: true,
                quantity: true,
            },
        });
        expect(transaction).toEqual({
            stockRequestId: fixture.request.id,
            stockRequestItemId: requestItem.id,
            referenceType: StockReferenceType.STOCK_REQUEST,
            referenceId: String(fixture.request.id),
            quantity: -fixture.requestedQuantity,
        });
        expect(await prisma.auditLog.count()).toBe(1);
        expect(await prisma.notification.count()).toBe(1);
    });

    it("ปิดแล้วเปิดวัสดุเดิมจะสลับ lifecycle ของ variant เดิมโดยไม่สร้างซ้ำ", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "REACTIVATE" });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });

        await stockService.updateItem(
            fixture.item.id,
            { isActive: false },
            fixture.issuerActor,
            "STOCK_ITEM_DELETE",
        );
        expect(await prisma.stockItemVariant.count({
            where: { stockItemId: fixture.item.id, isActive: true },
        })).toBe(0);

        const afterReactivation = await stockService.updateItem(
            fixture.item.id,
            { isActive: true },
            fixture.issuerActor,
        );
        expect(afterReactivation.variants).toHaveLength(1);
        expect(await prisma.stockItemVariant.count({
            where: { stockItemId: fixture.item.id },
        })).toBe(1);
        expect(await prisma.stockTransaction.count({
            where: { itemId: fixture.item.id, type: StockTxType.OPENING_BALANCE },
        })).toBe(0);
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
