import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { selectLegacyDefaultVariantId } from "@/lib/services/stock/legacy-default-variant";
import { lockStockInventoryRows } from "@/lib/services/stock/locks";
import { loadActiveDefaultVariantsByItemIds } from "@/lib/services/stock/shared";
import { setStockItemDefaultVariantIfUnset } from "@/lib/services/stock/default-variant-writer";

const BACKFILL_PAGE_SIZE = 500;
const READ_TRANSACTION_MAX_WAIT_MS = 10_000;
const READ_TRANSACTION_TIMEOUT_MS = 60_000;

export type DefaultVariantBackfillSnapshot = {
    items: Array<{
        id: number;
        sku: string;
        isActive: boolean;
        defaultVariantId: number | null;
        explicitDefaultVariantStockItemId: number | null;
    }>;
    variants: Array<{
        id: number;
        stockItemId: number;
        isActive: boolean;
    }>;
};

export type DefaultVariantClassification =
    | "READY_FOR_BACKFILL"
    | "ALREADY_MATCHES"
    | "NO_ACTIVE_VARIANT"
    | "CROSS_ITEM_DEFAULT"
    | "SHADOW_MISMATCH";

export type DefaultVariantBackfillDetail = {
    itemId: number;
    itemSku: string;
    itemIsActive: boolean;
    activeVariantCount: number;
    legacyDefaultVariantId: number | null;
    explicitDefaultVariantId: number | null;
    explicitDefaultVariantStockItemId: number | null;
    classification: DefaultVariantClassification;
};

export type DefaultVariantBackfillReport = {
    summary: {
        items: number;
        readyForBackfill: number;
        alreadyMatches: number;
        noActiveVariant: number;
        crossItemDefaults: number;
        shadowMismatches: number;
    };
    details: DefaultVariantBackfillDetail[];
    candidateItemIds: number[];
};

export type DefaultVariantBackfillApplyResult = {
    attempted: number;
    updated: number;
    skipped: number;
    updatedItemIds: number[];
    skippedItemIds: number[];
};

function classifyDefaultVariant(
    itemId: number,
    explicitDefaultVariantId: number | null,
    explicitDefaultVariantStockItemId: number | null,
    legacyDefaultVariantId: number | null,
): DefaultVariantClassification {
    if (
        explicitDefaultVariantId !== null
        && explicitDefaultVariantStockItemId !== itemId
    ) {
        return "CROSS_ITEM_DEFAULT";
    }
    if (
        legacyDefaultVariantId === null
        && explicitDefaultVariantId === null
    ) {
        return "NO_ACTIVE_VARIANT";
    }
    if (explicitDefaultVariantId === null) {
        return "READY_FOR_BACKFILL";
    }
    if (explicitDefaultVariantId === legacyDefaultVariantId) {
        return "ALREADY_MATCHES";
    }
    return "SHADOW_MISMATCH";
}

export function buildDefaultVariantBackfillReport(
    snapshot: DefaultVariantBackfillSnapshot,
): DefaultVariantBackfillReport {
    const activeVariantsByItemId =
        new Map<number, DefaultVariantBackfillSnapshot["variants"]>();

    for (const variant of snapshot.variants) {
        if (!variant.isActive) continue;
        const variants = activeVariantsByItemId.get(variant.stockItemId) ?? [];
        variants.push(variant);
        activeVariantsByItemId.set(variant.stockItemId, variants);
    }

    const details = snapshot.items
        .map((item): DefaultVariantBackfillDetail => {
            const activeVariants = activeVariantsByItemId.get(item.id) ?? [];
            const legacyDefaultVariantId =
                selectLegacyDefaultVariantId(activeVariants);

            return {
                itemId: item.id,
                itemSku: item.sku,
                itemIsActive: item.isActive,
                activeVariantCount: activeVariants.length,
                legacyDefaultVariantId,
                explicitDefaultVariantId: item.defaultVariantId,
                explicitDefaultVariantStockItemId:
                    item.explicitDefaultVariantStockItemId,
                classification: classifyDefaultVariant(
                    item.id,
                    item.defaultVariantId,
                    item.explicitDefaultVariantStockItemId,
                    legacyDefaultVariantId,
                ),
            };
        })
        .sort((left, right) => left.itemId - right.itemId);

    return {
        summary: {
            items: details.length,
            readyForBackfill: details.filter(
                (detail) => detail.classification === "READY_FOR_BACKFILL",
            ).length,
            alreadyMatches: details.filter(
                (detail) => detail.classification === "ALREADY_MATCHES",
            ).length,
            noActiveVariant: details.filter(
                (detail) => detail.legacyDefaultVariantId === null,
            ).length,
            crossItemDefaults: details.filter(
                (detail) => detail.classification === "CROSS_ITEM_DEFAULT",
            ).length,
            shadowMismatches: details.filter(
                (detail) => detail.classification === "SHADOW_MISMATCH",
            ).length,
        },
        details,
        candidateItemIds: details
            .filter((detail) => detail.classification === "READY_FOR_BACKFILL")
            .map((detail) => detail.itemId),
    };
}

export async function loadDefaultVariantBackfillReport(): Promise<
    DefaultVariantBackfillReport
> {
    const snapshot = await prisma.$transaction(async (tx) => {
        const items: DefaultVariantBackfillSnapshot["items"] = [];
        const variants: DefaultVariantBackfillSnapshot["variants"] = [];
        let cursor: number | undefined;

        while (true) {
            const page = await tx.stockItem.findMany({
                select: {
                    id: true,
                    sku: true,
                    isActive: true,
                    defaultVariantId: true,
                    defaultVariant: {
                        select: { stockItemId: true },
                    },
                    variants: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            stockItemId: true,
                            isActive: true,
                        },
                        orderBy: { id: "asc" },
                    },
                },
                orderBy: { id: "asc" },
                take: BACKFILL_PAGE_SIZE,
                ...(cursor !== undefined && {
                    cursor: { id: cursor },
                    skip: 1,
                }),
            });

            for (const {
                variants: itemVariants,
                defaultVariant,
                ...item
            } of page) {
                items.push({
                    ...item,
                    explicitDefaultVariantStockItemId:
                        defaultVariant?.stockItemId ?? null,
                });
                variants.push(...itemVariants);
            }
            if (page.length < BACKFILL_PAGE_SIZE) break;

            cursor = page.at(-1)?.id;
            if (cursor === undefined) break;
        }

        return { items, variants };
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: READ_TRANSACTION_MAX_WAIT_MS,
        timeout: READ_TRANSACTION_TIMEOUT_MS,
    });

    return buildDefaultVariantBackfillReport(snapshot);
}

async function applyDefaultVariantForItem(itemId: number): Promise<boolean> {
    return runSerializableTransaction(async (tx) => {
        await lockStockInventoryRows(tx, [itemId]);
        const item = await tx.stockItem.findUnique({
            where: { id: itemId },
            select: { defaultVariantId: true },
        });
        if (!item || item.defaultVariantId !== null) {
            return false;
        }

        const legacyDefaultVariant = (
            await loadActiveDefaultVariantsByItemIds(tx, [itemId])
        ).get(itemId);
        if (!legacyDefaultVariant) {
            return false;
        }

        return setStockItemDefaultVariantIfUnset(
            tx,
            itemId,
            legacyDefaultVariant.id,
        );
    });
}

export async function applyDefaultVariantBackfill(
    candidateItemIds: readonly number[],
): Promise<DefaultVariantBackfillApplyResult> {
    const uniqueItemIds = Array.from(new Set(candidateItemIds)).sort(
        (left, right) => left - right,
    );
    const updatedItemIds: number[] = [];
    const skippedItemIds: number[] = [];

    for (const itemId of uniqueItemIds) {
        if (await applyDefaultVariantForItem(itemId)) {
            updatedItemIds.push(itemId);
        } else {
            skippedItemIds.push(itemId);
        }
    }

    return {
        attempted: uniqueItemIds.length,
        updated: updatedItemIds.length,
        skipped: skippedItemIds.length,
        updatedItemIds,
        skippedItemIds,
    };
}
