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
import { stockService } from "../../index";
import {
    applyDefaultVariantBackfill,
    loadDefaultVariantBackfillReport,
} from "../../application/maintenance/default-variant-backfill";
import {
    InvalidStockDefaultVariantError,
    setStockItemDefaultVariantIfUnset,
} from "../../infrastructure/persistence/default-variant-writer";
import { createNewStockRequest } from "../../application/requests/request-creation";
import { StockInvariantViolationError } from "../../infrastructure/persistence/shared";
import { lockStockInventoryRows } from "../../infrastructure/persistence/locks";
import { createStockOpeningBalanceTransaction } from "../../infrastructure/persistence/write-helpers";
import {
    createRollbackTrigger,
    dropRollbackTrigger,
} from "../../../../__tests__/integration/mysql-trigger";
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

async function withExplicitDefaultReads<T>(
    operation: () => Promise<T>,
): Promise<T> {
    const previousFlag = process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED;
    process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED = "true";
    try {
        return await operation();
    } finally {
        if (previousFlag === undefined) {
            delete process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED;
        } else {
            process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED = previousFlag;
        }
    }
}

async function createTwoVariantStockItem(
    fixture: StockFixture,
    suffix: string,
    removedQuantity: number,
): Promise<Awaited<ReturnType<typeof stockService.createItem>>> {
    return stockService.createItem({
        name: `วัสดุทดสอบปิดรายการย่อย ${suffix}`,
        sku: `CLOSE-VARIANT-${suffix}-ITEM`,
        categoryId: fixture.category.id,
        variants: [
            {
                sku: `CLOSE-VARIANT-${suffix}-REMOVED`,
                unit: "ชิ้น",
                quantity: removedQuantity,
                minStock: 1,
                attributes: [{ name: "แบบ", value: "ปิด" }],
            },
            {
                sku: `CLOSE-VARIANT-${suffix}-REMAINING`,
                unit: "ชิ้น",
                quantity: 3,
                minStock: 1,
                attributes: [{ name: "แบบ", value: "คงไว้" }],
            },
        ],
    }, fixture.issuerActor);
}

function createPendingReservation(
    fixture: StockFixture,
    quantity: number,
    idempotencyKey: string,
): ReturnType<typeof createNewStockRequest> {
    return runSerializableTransaction((tx) =>
        createNewStockRequest(
            tx,
            {
                projectCode: `RESERVATION-${idempotencyKey}`,
                items: [{
                    itemId: fixture.item.id,
                    variantId: fixture.variant.id,
                    quantity,
                }],
            },
            fixture.requesterActor,
            {
                idempotencyKey,
                requestHash: idempotencyKey.padEnd(64, "0").slice(0, 64),
            },
        ),
    );
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

    it("reads item inventory permanently from active variants", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "variant-read",
        });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { quantity: 99 },
        });
        const variantDetail = await stockService.getItemById(fixture.item.id);
        const variantList = await stockService.getItems({
            page: 1,
            limit: 20,
            activeOnly: true,
        });

        expect(variantDetail?.quantity).toBe(10);
        expect(variantDetail?.minStock).toBe(fixture.minStock);
        expect(variantList.items[0]).toMatchObject({
            id: fixture.item.id,
            quantity: 10,
            minStock: fixture.minStock,
            reservedQuantity: 3,
            availableQuantity: 7,
        });
    });

    afterAll(async () => {
        await dropRollbackTrigger();
        await cleanIntegrationDatabase(prisma);
        await prisma.$disconnect();
    });

    it("สร้างวัสดุหนึ่ง variant โดย parent inventory คงค่า compatibility default", async () => {
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
        expect(created.defaultVariantId).toBe(created.variants[0]?.id);
        expect(created.variants[0]).toMatchObject({
            sku: "CREATE-ONE-VARIANT",
            quantity: 6,
            minStock: 2,
        });
        expect(await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: { quantity: true, minStock: true },
        })).toEqual({ quantity: 0, minStock: 0 });

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

    it("สร้างวัสดุหลาย variant พร้อม derived aggregate, ledger ราย variant และ SKU uniqueness", async () => {
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
        expect(created.defaultVariantId).toBe(created.variants[0]?.id);
        expect(created.variants.map((variant) => ({
            sku: variant.sku,
            quantity: variant.quantity,
        }))).toEqual([
            { sku: "CREATE-MULTI-BLACK", quantity: 4 },
            { sku: "CREATE-MULTI-CYAN", quantity: 7 },
        ]);
        expect(await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: { quantity: true, minStock: true },
        })).toEqual({ quantity: 0, minStock: 0 });
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

    it("ปฏิเสธการปิด variant ที่ยังมียอดคงเหลือ", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "CLOSE-POSITIVE",
        });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });
        const created = await createTwoVariantStockItem(
            fixture,
            "POSITIVE",
            7,
        );
        const removedVariant = created.variants[0];
        const remainingVariant = created.variants[1];
        if (!removedVariant || !remainingVariant) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await expect(stockService.updateItem(created.id, {
            variants: [{
                id: remainingVariant.id,
                expectedQuantity: remainingVariant.quantity,
                sku: remainingVariant.sku,
                unit: remainingVariant.unit,
                quantity: remainingVariant.quantity,
                minStock: remainingVariant.minStock,
                attributes: [{ name: "แบบ", value: "คงไว้" }],
            }],
        }, fixture.issuerActor)).rejects.toThrow(
            "ไม่สามารถปิดรายการย่อยที่ยังมียอดคงเหลือ กรุณาปรับยอดเป็นศูนย์ก่อน",
        );

        expect(await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: removedVariant.id },
            select: { quantity: true, isActive: true },
        })).toEqual({ quantity: 7, isActive: true });
        expect((await stockService.getItemById(created.id))?.quantity).toBe(10);
    });

    it("ปิด variant ที่ยอดคงเหลือเป็นศูนย์ได้", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "CLOSE-ZERO",
        });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });
        const created = await createTwoVariantStockItem(fixture, "ZERO", 0);
        const removedVariant = created.variants[0];
        const remainingVariant = created.variants[1];
        if (!removedVariant || !remainingVariant) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        const updated = await stockService.updateItem(created.id, {
            variants: [{
                id: remainingVariant.id,
                expectedQuantity: remainingVariant.quantity,
                sku: remainingVariant.sku,
                unit: remainingVariant.unit,
                quantity: remainingVariant.quantity,
                minStock: remainingVariant.minStock,
                attributes: [{ name: "แบบ", value: "คงไว้" }],
            }],
        }, fixture.issuerActor);

        expect(updated.quantity).toBe(3);
        expect(updated.variants.map((variant) => variant.id)).toEqual([
            remainingVariant.id,
        ]);
        expect(await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: removedVariant.id },
            select: { quantity: true, isActive: true },
        })).toEqual({ quantity: 0, isActive: false });
    });

    it("ปฏิเสธการปิด variant ที่มีคำขอรอจ่าย", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "CLOSE-PENDING",
        });
        const created = await createTwoVariantStockItem(fixture, "PENDING", 0);
        const removedVariant = created.variants[0];
        const remainingVariant = created.variants[1];
        if (!removedVariant || !remainingVariant) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await prisma.stockRequest.create({
            data: {
                requestedBy: fixture.requester.id,
                idempotencyKey: "close-pending-request",
                requestHash: "0".repeat(64),
                projectCode: "CLOSE-PENDING-PROJECT",
                status: StockRequestStatus.PENDING_ISSUE,
                items: {
                    create: {
                        itemId: created.id,
                        variantId: removedVariant.id,
                        quantity: 1,
                    },
                },
            },
        });

        await expect(stockService.updateItem(created.id, {
            variants: [{
                id: remainingVariant.id,
                expectedQuantity: remainingVariant.quantity,
                sku: remainingVariant.sku,
                unit: remainingVariant.unit,
                quantity: remainingVariant.quantity,
                minStock: remainingVariant.minStock,
                attributes: [{ name: "แบบ", value: "คงไว้" }],
            }],
        }, fixture.issuerActor)).rejects.toThrow("คำขอรอจ่าย");

        expect(await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: removedVariant.id },
            select: { quantity: true, isActive: true },
        })).toEqual({ quantity: 0, isActive: true });
    });

    it("ย้าย explicit default เมื่อ default variant ถูกปิดใช้งาน", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "DEFAULT-LIFECYCLE",
        });
        const created = await stockService.createItem({
            name: "วัสดุทดสอบ default lifecycle",
            sku: "DEFAULT-LIFECYCLE-ITEM",
            categoryId: fixture.category.id,
            variants: [
                {
                    sku: "DEFAULT-LIFECYCLE-A",
                    unit: "ชิ้น",
                    quantity: 3,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "A" }],
                },
                {
                    sku: "DEFAULT-LIFECYCLE-B",
                    unit: "ชิ้น",
                    quantity: 4,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "B" }],
                },
            ],
        }, fixture.issuerActor);
        const [removedDefault, remainingVariant] = created.variants;

        if (!removedDefault || !remainingVariant) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await stockService.updateItem(created.id, {
            variants: [
                {
                    id: removedDefault.id,
                    expectedQuantity: removedDefault.quantity,
                    sku: removedDefault.sku,
                    unit: removedDefault.unit,
                    quantity: 0,
                    minStock: removedDefault.minStock,
                    attributes: [{ name: "แบบ", value: "A" }],
                },
                {
                    id: remainingVariant.id,
                    expectedQuantity: remainingVariant.quantity,
                    sku: remainingVariant.sku,
                    unit: remainingVariant.unit,
                    quantity: remainingVariant.quantity,
                    minStock: remainingVariant.minStock,
                    attributes: [{ name: "แบบ", value: "B" }],
                },
            ],
        }, fixture.issuerActor);

        const updated = await stockService.updateItem(created.id, {
            variants: [{
                id: remainingVariant.id,
                expectedQuantity: remainingVariant.quantity,
                sku: remainingVariant.sku,
                unit: remainingVariant.unit,
                quantity: remainingVariant.quantity,
                minStock: remainingVariant.minStock,
                attributes: [{ name: "แบบ", value: "B" }],
            }],
        }, fixture.issuerActor);

        expect(updated.defaultVariantId).toBe(remainingVariant.id);
        expect((await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: removedDefault.id },
            select: { isActive: true },
        })).isActive).toBe(false);
    });

    it("ไม่ชุบชีวิต variant ที่ปิดไว้เมื่อปิดและเปิด parent", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "PARENT-LIFECYCLE",
        });
        const created = await stockService.createItem({
            name: "วัสดุทดสอบ parent lifecycle",
            sku: "PARENT-LIFECYCLE-ITEM",
            categoryId: fixture.category.id,
            variants: [
                {
                    sku: "PARENT-LIFECYCLE-B",
                    unit: "ชิ้น",
                    quantity: 4,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "B" }],
                },
                {
                    sku: "PARENT-LIFECYCLE-A",
                    unit: "ชิ้น",
                    quantity: 3,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "A" }],
                },
            ],
        }, fixture.issuerActor);
        const [inactiveVariant, activeDefaultVariant] = created.variants;
        if (!inactiveVariant || !activeDefaultVariant) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await prisma.stockItemVariant.update({
            where: { id: inactiveVariant.id },
            data: { isActive: false },
        });
        await prisma.stockItem.update({
            where: { id: created.id },
            data: { defaultVariantId: activeDefaultVariant.id },
        });

        await stockService.updateItem(
            created.id,
            { isActive: false },
            fixture.issuerActor,
        );
        await stockService.updateItem(
            created.id,
            { isActive: true },
            fixture.issuerActor,
        );

        const lifecycleState = await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: {
                isActive: true,
                defaultVariantId: true,
                variants: {
                    orderBy: { id: "asc" },
                    select: { id: true, isActive: true },
                },
            },
        });
        expect(lifecycleState).toEqual({
            isActive: true,
            defaultVariantId: activeDefaultVariant.id,
            variants: [
                { id: inactiveVariant.id, isActive: false },
                { id: activeDefaultVariant.id, isActive: true },
            ],
        });
    });

    it("ปิด parent พร้อมส่ง variants แล้วคง lifecycle ของ submitted และ inactive variant", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "PARENT-SUBMITTED-VARIANTS",
        });
        const created = await stockService.createItem({
            name: "วัสดุทดสอบ parent พร้อมรายการย่อย",
            sku: "PARENT-SUBMITTED-VARIANTS-ITEM",
            categoryId: fixture.category.id,
            variants: [
                {
                    sku: "PARENT-SUBMITTED-VARIANTS-A",
                    unit: "ชิ้น",
                    quantity: 4,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "A" }],
                },
                {
                    sku: "PARENT-SUBMITTED-VARIANTS-B",
                    unit: "ชิ้น",
                    quantity: 0,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "B" }],
                },
            ],
        }, fixture.issuerActor);
        const [variantA, variantB] = created.variants;
        if (!variantA || !variantB) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await prisma.stockItemVariant.update({
            where: { id: variantB.id },
            data: { isActive: false },
        });
        await prisma.stockItem.update({
            where: { id: created.id },
            data: { defaultVariantId: variantA.id },
        });
        const transactionCountBeforeClose = await prisma.stockTransaction.count({
            where: { itemId: created.id },
        });

        await stockService.updateItem(
            created.id,
            {
                isActive: false,
                variants: [{
                    id: variantA.id,
                    expectedQuantity: variantA.quantity,
                    sku: variantA.sku,
                    unit: variantA.unit,
                    quantity: variantA.quantity,
                    minStock: variantA.minStock,
                    attributes: [{ name: "แบบ", value: "A" }],
                }],
            },
            fixture.issuerActor,
        );

        const afterClose = await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: {
                isActive: true,
                defaultVariantId: true,
                variants: {
                    orderBy: { id: "asc" },
                    select: { id: true, quantity: true, isActive: true },
                },
            },
        });
        expect(afterClose).toEqual({
            isActive: false,
            defaultVariantId: variantA.id,
            variants: [
                { id: variantA.id, quantity: 4, isActive: true },
                { id: variantB.id, quantity: 0, isActive: false },
            ],
        });
        expect(await prisma.stockTransaction.count({
            where: { itemId: created.id },
        })).toBe(transactionCountBeforeClose);

        await stockService.updateItem(
            created.id,
            { isActive: true },
            fixture.issuerActor,
        );

        const afterOpen = await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: {
                isActive: true,
                defaultVariantId: true,
                variants: {
                    orderBy: { id: "asc" },
                    select: { id: true, quantity: true, isActive: true },
                },
            },
        });
        expect(afterOpen).toEqual({
            isActive: true,
            defaultVariantId: variantA.id,
            variants: [
                { id: variantA.id, quantity: 4, isActive: true },
                { id: variantB.id, quantity: 0, isActive: false },
            ],
        });
        expect((await stockService.getItemById(created.id))?.quantity).toBe(4);
    });

    it("เพิ่ม variant ขณะ parent ปิดแล้วเปิดกลับโดยไม่สร้าง opening balance ซ้ำ", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "ADD-INACTIVE-PARENT",
        });
        const created = await stockService.createItem({
            name: "วัสดุทดสอบเพิ่มรายการย่อยขณะ parent ปิด",
            sku: "ADD-INACTIVE-PARENT-ITEM",
            categoryId: fixture.category.id,
            variants: [{
                sku: "ADD-INACTIVE-PARENT-EXISTING",
                unit: "ชิ้น",
                quantity: 2,
                minStock: 1,
                attributes: [{ name: "แบบ", value: "เดิม" }],
            }],
        }, fixture.issuerActor);
        const existingVariant = created.variants[0];
        if (!existingVariant) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await stockService.updateItem(
            created.id,
            { isActive: false },
            fixture.issuerActor,
        );
        const openingBalanceCountBeforeAdd = await prisma.stockTransaction.count({
            where: { itemId: created.id, type: StockTxType.OPENING_BALANCE },
        });

        await stockService.updateItem(
            created.id,
            {
                isActive: false,
                variants: [
                    {
                        id: existingVariant.id,
                        expectedQuantity: existingVariant.quantity,
                        sku: existingVariant.sku,
                        unit: existingVariant.unit,
                        quantity: existingVariant.quantity,
                        minStock: existingVariant.minStock,
                        attributes: [{ name: "แบบ", value: "เดิม" }],
                    },
                    {
                        sku: "ADD-INACTIVE-PARENT-NEW",
                        unit: "ชิ้น",
                        quantity: 5,
                        minStock: 2,
                        attributes: [{ name: "แบบ", value: "ใหม่" }],
                    },
                ],
            },
            fixture.issuerActor,
        );

        const newVariant = await prisma.stockItemVariant.findUniqueOrThrow({
            where: { sku: "ADD-INACTIVE-PARENT-NEW" },
            select: { id: true, quantity: true, isActive: true },
        });
        expect(newVariant).toEqual({
            id: newVariant.id,
            quantity: 5,
            isActive: true,
        });
        expect(await prisma.stockTransaction.count({
            where: { itemId: created.id, type: StockTxType.OPENING_BALANCE },
        })).toBe(openingBalanceCountBeforeAdd + 1);
        expect(await prisma.stockTransaction.count({
            where: {
                itemId: created.id,
                variantId: newVariant.id,
                type: StockTxType.OPENING_BALANCE,
            },
        })).toBe(1);

        await stockService.updateItem(
            created.id,
            { isActive: true },
            fixture.issuerActor,
        );

        const afterOpen = await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: {
                isActive: true,
                defaultVariantId: true,
                variants: {
                    orderBy: { id: "asc" },
                    select: { id: true, quantity: true, isActive: true },
                },
            },
        });
        expect(afterOpen).toMatchObject({
            isActive: true,
            defaultVariantId: existingVariant.id,
            variants: [
                { id: existingVariant.id, quantity: 2, isActive: true },
                { id: newVariant.id, quantity: 5, isActive: true },
            ],
        });
        expect(afterOpen.variants).toHaveLength(2);
        expect((await stockService.getItemById(created.id))?.quantity).toBe(7);
        expect(await prisma.stockTransaction.count({
            where: { itemId: created.id, type: StockTxType.OPENING_BALANCE },
        })).toBe(openingBalanceCountBeforeAdd + 1);
        expect(await prisma.stockItemVariant.count({
            where: { stockItemId: created.id },
        })).toBe(2);
    });

    it("variant ที่ถอดออกแล้วไม่กลับมา active หลังปิดและเปิด parent", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "REMOVED-VARIANT-LIFECYCLE",
        });
        const created = await stockService.createItem({
            name: "วัสดุทดสอบ lifecycle รายการย่อยที่ถอดออก",
            sku: "REMOVED-VARIANT-LIFECYCLE-ITEM",
            categoryId: fixture.category.id,
            variants: [
                {
                    sku: "REMOVED-VARIANT-LIFECYCLE-A",
                    unit: "ชิ้น",
                    quantity: 3,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "A" }],
                },
                {
                    sku: "REMOVED-VARIANT-LIFECYCLE-B",
                    unit: "ชิ้น",
                    quantity: 0,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "B" }],
                },
            ],
        }, fixture.issuerActor);
        const [variantA, variantB] = created.variants;
        if (!variantA || !variantB) {
            throw new Error("สร้างรายการย่อยสำหรับ integration test ไม่ครบ");
        }

        await stockService.updateItem(
            created.id,
            {
                variants: [{
                    id: variantA.id,
                    expectedQuantity: variantA.quantity,
                    sku: variantA.sku,
                    unit: variantA.unit,
                    quantity: variantA.quantity,
                    minStock: variantA.minStock,
                    attributes: [{ name: "แบบ", value: "A" }],
                }],
            },
            fixture.issuerActor,
        );
        expect((await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: variantB.id },
            select: { isActive: true },
        })).isActive).toBe(false);

        await stockService.updateItem(
            created.id,
            {
                isActive: false,
                variants: [{
                    id: variantA.id,
                    expectedQuantity: variantA.quantity,
                    sku: variantA.sku,
                    unit: variantA.unit,
                    quantity: variantA.quantity,
                    minStock: variantA.minStock,
                    attributes: [{ name: "แบบ", value: "A" }],
                }],
            },
            fixture.issuerActor,
        );
        await stockService.updateItem(
            created.id,
            { isActive: true },
            fixture.issuerActor,
        );

        const lifecycleState = await prisma.stockItem.findUniqueOrThrow({
            where: { id: created.id },
            select: {
                isActive: true,
                defaultVariantId: true,
                variants: {
                    orderBy: { id: "asc" },
                    select: { id: true, isActive: true },
                },
            },
        });
        expect(lifecycleState).toEqual({
            isActive: true,
            defaultVariantId: variantA.id,
            variants: [
                { id: variantA.id, isActive: true },
                { id: variantB.id, isActive: false },
            ],
        });
        expect((await stockService.getItemById(created.id))?.variants.map(
            (variant) => variant.id,
        )).toEqual([variantA.id]);
    });

    it("ใช้ explicit default ตอนแก้ parent โดยไม่ส่ง variants เมื่อเปิด flag", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "DEFAULT-UPDATE",
        });
        const created = await stockService.createItem({
            name: "วัสดุทดสอบ explicit update",
            sku: "DEFAULT-UPDATE-ITEM",
            categoryId: fixture.category.id,
            variants: [
                {
                    sku: "DEFAULT-UPDATE-A",
                    unit: "ชิ้น",
                    quantity: 3,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "A" }],
                },
                {
                    sku: "DEFAULT-UPDATE-B",
                    unit: "ชิ้น",
                    quantity: 4,
                    minStock: 1,
                    attributes: [{ name: "แบบ", value: "B" }],
                },
            ],
        }, fixture.issuerActor);
        const [legacyDefault, explicitDefault] = created.variants;
        await prisma.stockItem.update({
            where: { id: created.id },
            data: { defaultVariantId: explicitDefault.id },
        });
        const previousFlag =
            process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED;
        process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED = "true";

        try {
            await stockService.updateItem(
                created.id,
                { minStock: 5 },
                fixture.issuerActor,
            );
            expect(await prisma.stockItemVariant.findMany({
                where: { id: { in: [legacyDefault.id, explicitDefault.id] } },
                orderBy: { id: "asc" },
                select: { id: true, minStock: true },
            })).toEqual([
                { id: legacyDefault.id, minStock: 1 },
                { id: explicitDefault.id, minStock: 5 },
            ]);

            await prisma.stockItemVariant.updateMany({
                where: { id: { in: [legacyDefault.id, explicitDefault.id] } },
                data: { minStock: 1 },
            });
            await prisma.stockItemVariant.update({
                where: { id: legacyDefault.id },
                data: { isActive: false },
            });
            await prisma.stockItem.update({
                where: { id: created.id },
                data: { defaultVariantId: null },
            });

            await stockService.updateItem(
                created.id,
                { minStock: 6 },
                fixture.issuerActor,
            );
            expect(await prisma.stockItemVariant.findMany({
                where: { id: { in: [legacyDefault.id, explicitDefault.id] } },
                orderBy: { id: "asc" },
                select: { id: true, minStock: true },
            })).toEqual([
                { id: legacyDefault.id, minStock: 1 },
                { id: explicitDefault.id, minStock: 6 },
            ]);
        } finally {
            if (previousFlag === undefined) {
                delete process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED;
            } else {
                process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED = previousFlag;
            }
        }
    });

    it("เก็บ resolved default variant ตอนสร้างคำขอก่อนจ่าย แม้ default เปลี่ยนภายหลัง", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "DEFAULT-REQUEST",
        });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });
        const explicitVariant = await prisma.stockItemVariant.create({
            data: {
                stockItemId: fixture.item.id,
                sku: "DEFAULT-REQUEST-EXPLICIT",
                unit: "ชิ้น",
                quantity: fixture.quantity,
                minStock: fixture.minStock,
            },
        });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { defaultVariantId: explicitVariant.id },
        });

        await withExplicitDefaultReads(async () => {
            const request = await prisma.$transaction((tx) =>
                createNewStockRequest(
                    tx,
                    {
                        projectCode: "DEFAULT-REQUEST-PROJECT",
                        items: [{
                            itemId: fixture.item.id,
                            quantity: 2,
                        }],
                    },
                    fixture.requesterActor,
                    {
                        idempotencyKey: "default-request-explicit",
                        requestHash: "1".repeat(64),
                    },
                ),
            );
            const requestItem = request.items[0];
            if (!requestItem) {
                throw new Error("ไม่พบรายการคำขอทดสอบ");
            }
            expect(requestItem.variantId).toBe(explicitVariant.id);

            await prisma.stockItem.update({
                where: { id: fixture.item.id },
                data: { defaultVariantId: fixture.variant.id },
            });
            await stockService.issueRequest(
                request.id,
                fixture.issuerActor,
            );

            expect((await prisma.stockItemVariant.findUniqueOrThrow({
                where: { id: fixture.variant.id },
                select: { quantity: true },
            })).quantity).toBe(fixture.quantity);
            expect((await prisma.stockItemVariant.findUniqueOrThrow({
                where: { id: explicitVariant.id },
                select: { quantity: true },
            })).quantity).toBe(fixture.quantity - 2);
            expect(await prisma.stockTransaction.findFirst({
                where: {
                    stockRequestId: request.id,
                    type: StockTxType.OUT,
                },
                select: { variantId: true },
            })).toEqual({ variantId: explicitVariant.id });
        });
    });

    it("ไม่สร้างคำขอใหม่เมื่อ pending request ไม่มี variant snapshot", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "PENDING-NULL-RESERVATION",
        });
        await prisma.stockRequestItem.updateMany({
            where: { requestId: fixture.request.id },
            data: { variantId: null },
        });

        await expect(
            prisma.$transaction((tx) =>
                createNewStockRequest(
                    tx,
                    {
                        projectCode: "PENDING-NULL-RESERVATION-PROJECT",
                        items: [{
                            itemId: fixture.item.id,
                            variantId: fixture.variant.id,
                            quantity: 1,
                        }],
                    },
                    fixture.requesterActor,
                    {
                        idempotencyKey: "pending-null-reservation",
                        requestHash: "3".repeat(64),
                    },
                ),
            ),
        ).rejects.toBeInstanceOf(StockInvariantViolationError);

        expect(await prisma.stockRequest.count()).toBe(1);
    });

    it("fallback ไป lowest active เมื่อ explicit default ใช้งานไม่ได้", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "DEFAULT-FALLBACK",
        });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });
        const inactiveExplicit = await prisma.stockItemVariant.create({
            data: {
                stockItemId: fixture.item.id,
                sku: "DEFAULT-FALLBACK-INACTIVE",
                unit: "ชิ้น",
                quantity: fixture.quantity,
                minStock: fixture.minStock,
                isActive: false,
            },
        });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { defaultVariantId: inactiveExplicit.id },
        });

        await withExplicitDefaultReads(async () => {
            const request = await prisma.$transaction((tx) =>
                createNewStockRequest(
                    tx,
                    {
                        projectCode: "DEFAULT-FALLBACK-PROJECT",
                        items: [{
                            itemId: fixture.item.id,
                            quantity: 1,
                        }],
                    },
                    fixture.requesterActor,
                    {
                        idempotencyKey: "default-request-fallback",
                        requestHash: "2".repeat(64),
                    },
                ),
            );

            expect(request.items[0]?.variantId).toBe(fixture.variant.id);
        });
    });

    it("จ่ายคำขอแล้วลดเฉพาะ variant พร้อมบันทึก ledger, audit และ outbox", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "ISSUE-FLOW",
            minStock: 8,
        });

        const result = await stockService.issueRequest(
            fixture.request.id,
            fixture.issuerActor,
        );
        const visibleItem = await stockService.getItemById(fixture.item.id);
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
        expect(inventory.item.quantity).toBe(10);
        expect(inventory.variant.quantity).toBe(7);
        expect(visibleItem?.quantity).toBe(7);
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

    it("ปรับจุดสั่งซื้อแล้วแจ้งเตือนจาก variant แม้ parent aggregate ยังสูง", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "ADJUST-VARIANT-LOW",
            quantity: 100,
            minStock: 20,
        });
        const secondVariant = await prisma.stockItemVariant.create({
            data: {
                stockItemId: fixture.item.id,
                sku: "ADJUST-VARIANT-LOW-SECOND",
                unit: "ชิ้น",
                quantity: 100,
                minStock: 20,
            },
        });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: {
                quantity: 200,
                minStock: 40,
            },
        });

        const result = await stockService.adjustStock(
            fixture.item.id,
            {
                variantId: fixture.variant.id,
                type: StockTxType.IN,
                quantity: 1,
                minStock: 110,
            },
            fixture.issuerActor,
        );
        const inventory = await prisma.stockItem.findUniqueOrThrow({
            where: { id: fixture.item.id },
            select: {
                quantity: true,
                minStock: true,
                variants: {
                    select: { id: true, quantity: true, minStock: true },
                    orderBy: { id: "asc" },
                },
            },
        });

        expect(result.lowStockAlerts).toEqual([{
            itemId: fixture.item.id,
            name: fixture.item.name,
            sku: fixture.item.sku,
            quantity: 101,
            minStock: 110,
            unit: fixture.variant.unit,
        }]);
        expect(result).toMatchObject({
            previousQty: 200,
            newQty: 201,
            previousMinStock: 40,
            newMinStock: 130,
        });
        expect(inventory).toEqual({
            quantity: 200,
            minStock: 40,
            variants: [
                {
                    id: fixture.variant.id,
                    quantity: 101,
                    minStock: 110,
                },
                {
                    id: secondVariant.id,
                    quantity: 100,
                    minStock: 20,
                },
            ],
        });
        expect(await prisma.notificationOutbox.count({
            where: { type: "STOCK_LOW_LINE" },
        })).toBe(1);
        expect((await prisma.notificationOutbox.findFirstOrThrow({
            where: { type: "STOCK_LOW_LINE" },
            select: { payload: true },
        })).payload).toContain(`"variantId":${fixture.variant.id}`);
    });

    it("ไม่ปรับ stock เมื่อ parent ปิดใช้งาน", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "ADJUST-INACTIVE-PARENT",
        });
        await prisma.stockItem.update({
            where: { id: fixture.item.id },
            data: { isActive: false },
        });

        await expect(
            stockService.adjustStock(
                fixture.item.id,
                {
                    variantId: fixture.variant.id,
                    type: StockTxType.IN,
                    quantity: 1,
                    minStock: fixture.minStock,
                },
                fixture.issuerActor,
            ),
        ).rejects.toThrow("ไม่สามารถปรับสต็อกของวัสดุที่ปิดใช้งานแล้ว");

        const inventory = await readInventory(fixture);
        expect(inventory.item.quantity).toBe(fixture.quantity);
        expect(inventory.variant.quantity).toBe(fixture.quantity);
        expect(await prisma.stockTransaction.count()).toBe(0);
        expect(await prisma.auditLog.count()).toBe(0);
        expect(await prisma.notificationOutbox.count()).toBe(0);
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

    it("ปฏิเสธการจ่ายคำขอ pending ที่ไม่มี variant snapshot", async () => {
        const fixture = await createStockFixture(prisma, { suffix: "LEGACY-DEFAULT" });
        await prisma.stockRequestItem.updateMany({
            where: { requestId: fixture.request.id },
            data: { variantId: null },
        });

        await expect(
            stockService.issueRequest(fixture.request.id, fixture.issuerActor),
        ).rejects.toThrow("ยังไม่ได้ระบุ");

        expect((await prisma.stockItemVariant.findUniqueOrThrow({
            where: { id: fixture.variant.id },
        })).quantity).toBe(10);
        expect((await prisma.stockRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
        })).status).toBe(StockRequestStatus.PENDING_ISSUE);
        expect(await prisma.stockTransaction.count({
            where: { stockRequestId: fixture.request.id },
        })).toBe(0);
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

    it("คำขอรอจ่าย 7 + 7 พร้อมกันไม่จองเกินสต็อก 10", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "RESERVATION-OVER",
            quantity: 10,
        });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });

        const results = await Promise.allSettled([
            createPendingReservation(fixture, 7, "reservation-over-a"),
            createPendingReservation(fixture, 7, "reservation-over-b"),
        ]);
        const reserved = await prisma.stockRequestItem.aggregate({
            where: {
                variantId: fixture.variant.id,
                request: { status: StockRequestStatus.PENDING_ISSUE },
            },
            _sum: { quantity: true },
        });

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
        expect(reserved._sum.quantity ?? 0).toBeLessThanOrEqual(10);
        expect(await prisma.stockRequest.count({
            where: {
                requestedBy: fixture.requester.id,
                status: StockRequestStatus.PENDING_ISSUE,
            },
        })).toBe(1);
    });

    it("คำขอรอจ่าย 5 + 5 พร้อมกันจองได้พอดีสต็อก 10", async () => {
        const fixture = await createStockFixture(prisma, {
            suffix: "RESERVATION-BOUNDARY",
            quantity: 10,
        });
        await prisma.stockRequest.delete({ where: { id: fixture.request.id } });

        const results = await Promise.allSettled([
            createPendingReservation(fixture, 5, "reservation-boundary-a"),
            createPendingReservation(fixture, 5, "reservation-boundary-b"),
        ]);
        const reserved = await prisma.stockRequestItem.aggregate({
            where: {
                variantId: fixture.variant.id,
                request: { status: StockRequestStatus.PENDING_ISSUE },
            },
            _sum: { quantity: true },
        });

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
        expect(reserved._sum.quantity).toBe(10);
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
        expect(inventory.item.quantity).toBe(10);
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

    it("ปิดแล้วเปิดวัสดุเดิมจะคง lifecycle และ default ของ variant เดิม", async () => {
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
        })).toBe(1);
        expect((await prisma.stockItem.findUniqueOrThrow({
            where: { id: fixture.item.id },
            select: { defaultVariantId: true },
        })).defaultVariantId).toBe(fixture.variant.id);

        const afterReactivation = await stockService.updateItem(
            fixture.item.id,
            {
                isActive: true,
                minStock: 7,
            },
            fixture.issuerActor,
        );
        expect(afterReactivation.variants).toHaveLength(1);
        expect(afterReactivation.defaultVariantId).toBe(fixture.variant.id);
        expect(afterReactivation.variants[0]?.minStock).toBe(7);
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
        expect(inventory.item.quantity).toBe(10);
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
        expect(inventory.item.quantity).toBe(10);
        expect(inventory.variant.quantity).toBe(updateSucceeded ? 11 : 7);
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
        expect(inventory.item.quantity).toBe(10);
        expect([12, 15]).toContain(inventory.variant.quantity);
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
