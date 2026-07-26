import { StockTxType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { createStockCommandAudit } from "./command-audit";
import { lockStockInventoryRows } from "./locks";
import { createStockOpeningBalanceTransaction } from "./write-helpers";
import type { StockCommandActor } from "./types";

export type StockRepairAuthority = "ADMIN" | "SYSTEM";

export type StockRepairActor = StockCommandActor & {
    authority: StockRepairAuthority;
};

export type LegacyRepairStatus =
    | "repaired"
    | "skipped"
    | "conflicted"
    | "failed";

export type LegacyRepairItemResult = {
    itemId: number;
    sku: string | null;
    quantity: number | null;
    itemIsActive: boolean | null;
    persistedVariantCount: number;
    activeVariantCount: number;
    inactiveVariantCount: number;
    legacyCandidate: boolean;
    status: LegacyRepairStatus;
    reason: string;
    variantId?: number;
    openingBalanceTransactionId?: number;
};

export type LegacyRepairSummary = {
    requested: number;
    legacyCandidates: number;
    repaired: number;
    skipped: number;
    conflicted: number;
    failed: number;
};

export type LegacyRepairResult = {
    dryRun: boolean;
    items: LegacyRepairItemResult[];
    summary: LegacyRepairSummary;
};

export type LegacyRepairOptions = {
    dryRun?: boolean;
};

type RepairItemRecord = {
    id: number;
    sku: string;
    quantity: number;
    unit: string;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
};

type RepairVariantRecord = {
    id: number;
    stockItemId: number;
    sku: string;
    isActive: boolean;
};

async function assertRepairAuthority(actor: StockRepairActor): Promise<void> {
    if (actor.authority !== "ADMIN" && actor.authority !== "SYSTEM") {
        throw new Error("ไม่มีสิทธิ์ซ่อมข้อมูลรายการย่อยสต็อก");
    }

    const user = await prisma.user.findUnique({
        where: { id: actor.id },
        select: { role: true, isActive: true, deletedAt: true },
    });
    if (
        !user
        || !user.isActive
        || user.deletedAt !== null
        || (actor.authority === "ADMIN" && user.role !== "ADMIN")
    ) {
        throw new Error("ผู้สั่งซ่อมต้องเป็นผู้ดูแลระบบที่ยังใช้งานอยู่");
    }
}

function buildVariantCounts(variants: RepairVariantRecord[]): {
    activeVariantCount: number;
    inactiveVariantCount: number;
} {
    const activeVariantCount = variants.filter((variant) => variant.isActive).length;
    return {
        activeVariantCount,
        inactiveVariantCount: variants.length - activeVariantCount,
    };
}

function buildSkippedResult(
    item: RepairItemRecord,
    variants: RepairVariantRecord[],
    reason: string,
): LegacyRepairItemResult {
    const counts = buildVariantCounts(variants);
    return {
        itemId: item.id,
        sku: item.sku,
        quantity: item.quantity,
        itemIsActive: item.isActive,
        persistedVariantCount: variants.length,
        ...counts,
        legacyCandidate: variants.length === 0,
        status: "skipped",
        reason,
    };
}

async function repairOneItem(
    itemId: number,
    actor: StockRepairActor,
    dryRun: boolean,
): Promise<LegacyRepairItemResult> {
    return runSerializableTransaction(async (tx) => {
        await lockStockInventoryRows(tx, [itemId]);

        const item = await tx.stockItem.findUnique({
            where: { id: itemId },
            select: {
                id: true,
                sku: true,
                quantity: true,
                unit: true,
                minStock: true,
                imageUrl: true,
                isActive: true,
            },
        });
        if (!item) {
            return {
                itemId,
                sku: null,
                quantity: null,
                itemIsActive: null,
                persistedVariantCount: 0,
                activeVariantCount: 0,
                inactiveVariantCount: 0,
                legacyCandidate: false,
                status: "failed",
                reason: "ไม่พบวัสดุ",
            };
        }

        const variants = await tx.stockItemVariant.findMany({
            where: { stockItemId: item.id },
            select: { id: true, stockItemId: true, sku: true, isActive: true },
            orderBy: { id: "asc" },
        });
        if (variants.length > 0) {
            return buildSkippedResult(item, variants, "มีรายการย่อยอยู่แล้ว");
        }
        if (dryRun) {
            return buildSkippedResult(item, variants, "โหมดตรวจสอบ ไม่ได้แก้ไขข้อมูล");
        }

        const conflictingVariant = await tx.stockItemVariant.findUnique({
            where: { sku: item.sku },
            select: { id: true, stockItemId: true },
        });
        if (conflictingVariant) {
            return {
                ...buildSkippedResult(item, variants, "SKU ซ้ำกับรายการย่อยอื่น"),
                status: "conflicted",
            };
        }

        const existingOpeningBalance = await tx.stockTransaction.findFirst({
            where: {
                itemId: item.id,
                type: StockTxType.OPENING_BALANCE,
            },
            select: { id: true, variantId: true },
            orderBy: { id: "asc" },
        });

        const variant = await tx.stockItemVariant.create({
            data: {
                stockItemId: item.id,
                sku: item.sku,
                unit: item.unit,
                quantity: item.quantity,
                minStock: item.minStock,
                imageUrl: item.imageUrl,
                // Parent controls the lifecycle of legacy/default variants.
                isActive: item.isActive,
            },
            select: { id: true },
        });
        if (existingOpeningBalance?.variantId === null) {
            await tx.stockTransaction.update({
                where: { id: existingOpeningBalance.id },
                data: { variantId: variant.id },
            });
        }
        const openingBalanceTransactionId = existingOpeningBalance?.id
            ?? await createStockOpeningBalanceTransaction(
                tx,
                item.id,
                variant.id,
                item.quantity,
                actor.id,
            );

        await createStockCommandAudit(
            tx,
            "STOCK_ITEM_UPDATE",
            item.id,
            actor,
            {
                after: {
                    variantId: variant.id,
                    sku: item.sku,
                    quantity: item.quantity,
                },
                metadata: {
                    operation: "LEGACY_VARIANT_BACKFILL",
                    authority: actor.authority,
                    itemId: item.id,
                    variantId: variant.id,
                    openingBalanceTransactionId,
                },
            },
        );

        return {
            itemId: item.id,
            sku: item.sku,
            quantity: item.quantity,
            itemIsActive: item.isActive,
            persistedVariantCount: 1,
            activeVariantCount: item.isActive ? 1 : 0,
            inactiveVariantCount: item.isActive ? 0 : 1,
            legacyCandidate: true,
            status: "repaired",
            reason: "สร้างรายการย่อยและยอดตั้งต้นแล้ว",
            variantId: variant.id,
            openingBalanceTransactionId,
        };
    });
}

function summarizeRepairResults(
    results: LegacyRepairItemResult[],
): LegacyRepairSummary {
    return {
        requested: results.length,
        legacyCandidates: results.filter((result) => result.legacyCandidate).length,
        repaired: results.filter((result) => result.status === "repaired").length,
        skipped: results.filter((result) => result.status === "skipped").length,
        conflicted: results.filter((result) => result.status === "conflicted").length,
        failed: results.filter((result) => result.status === "failed").length,
    };
}

function uniqueItemIds(itemIds: readonly number[] | undefined): number[] {
    return Array.from(new Set(itemIds ?? [])).sort((left, right) => left - right);
}

export async function repairLegacyStockItemVariants(
    actor: StockRepairActor,
    itemIds?: readonly number[],
    options: LegacyRepairOptions = {},
): Promise<LegacyRepairResult> {
    await assertRepairAuthority(actor);

    const requestedItemIds = uniqueItemIds(itemIds);
    const targetItemIds = requestedItemIds.length > 0
        ? requestedItemIds
        : (await prisma.stockItem.findMany({
              select: { id: true },
              orderBy: { id: "asc" },
          })).map((item) => item.id);
    const results: LegacyRepairItemResult[] = [];
    const dryRun = options.dryRun ?? false;

    for (const itemId of targetItemIds) {
        try {
            results.push(await repairOneItem(itemId, actor, dryRun));
        } catch (error) {
            results.push({
                itemId,
                sku: null,
                quantity: null,
                itemIsActive: null,
                persistedVariantCount: 0,
                activeVariantCount: 0,
                inactiveVariantCount: 0,
                legacyCandidate: false,
                status: "failed",
                reason: error instanceof Error ? error.message : "ซ่อมข้อมูลไม่สำเร็จ",
            });
        }
    }

    return {
        dryRun,
        items: results,
        summary: summarizeRepairResults(results),
    };
}
