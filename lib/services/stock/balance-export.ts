import { StockRequestStatus } from "@prisma/client";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { prisma } from "@/lib/db/prisma";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import {
    createStockBalanceReportWorkbook,
    type StockBalanceVariant,
    type StockBalanceItem,
} from "@/lib/services/stock/balance-workbook";
import {
    buildItemInclude,
    buildReservedQuantityMaps,
    ensureItemVariantsExist,
    getAvailableQuantity,
} from "./shared";
import type { PendingRequestItemRecord } from "./types";

type LoadedStockBalanceVariant = Omit<
    StockBalanceVariant,
    "reservedQuantity" | "availableQuantity"
>;
type LoadedStockBalanceItem = Omit<
    StockBalanceItem,
    "reservedQuantity" | "availableQuantity" | "variants"
> & {
    variants: LoadedStockBalanceVariant[];
};

async function loadActiveStockItems(): Promise<StockBalanceItem[]> {
    const items = await loadItemsWithVariants();
    const pendingRequestItems = await loadPendingRequestItems(
        items.map((item) => item.id),
    );
    const { reservedByItemId, reservedByVariantId } = buildReservedQuantityMaps(
        pendingRequestItems,
        buildDefaultVariantIdByItemId(items),
    );

    return items.map((item) =>
        toStockBalanceItem(item, reservedByItemId, reservedByVariantId),
    );
}

async function loadItemsWithVariants(): Promise<LoadedStockBalanceItem[]> {
    let items = await prisma.stockItem.findMany({
        where: { isActive: true },
        include: buildItemInclude(),
        orderBy: { name: "asc" },
    });

    const missingVariantItemIds = items
        .filter((item) => item.variants.length === 0)
        .map((item) => item.id);

    if (missingVariantItemIds.length > 0) {
        await ensureItemVariantsExist(missingVariantItemIds);
        items = await prisma.stockItem.findMany({
            where: { isActive: true },
            include: buildItemInclude(),
            orderBy: { name: "asc" },
        });
    }

    return items;
}

async function loadPendingRequestItems(
    itemIds: number[],
): Promise<PendingRequestItemRecord[]> {
    if (itemIds.length === 0) {
        return [];
    }

    return prisma.stockRequestItem.findMany({
        where: {
            itemId: { in: itemIds },
            request: { status: StockRequestStatus.PENDING_ISSUE },
        },
        select: {
            itemId: true,
            variantId: true,
            quantity: true,
        },
    });
}

function buildDefaultVariantIdByItemId(
    items: LoadedStockBalanceItem[],
): Map<number, number> {
    return new Map(
        items
            .map((item) => [item.id, item.variants[0]?.id] as const)
            .filter((entry): entry is readonly [number, number] => entry[1] !== undefined),
    );
}

function toStockBalanceItem(
    item: LoadedStockBalanceItem,
    reservedByItemId: Map<number, number>,
    reservedByVariantId: Map<number, number>,
): StockBalanceItem {
    const reservedQuantity = reservedByItemId.get(item.id) ?? 0;
    const totalQuantity = getTotalQuantity(item);

    return {
        ...item,
        reservedQuantity,
        availableQuantity: getAvailableQuantity(totalQuantity, reservedQuantity),
        variants: item.variants.map((variant) =>
            toStockBalanceVariant(variant, reservedByVariantId),
        ),
    };
}

function toStockBalanceVariant(
    variant: LoadedStockBalanceVariant,
    reservedByVariantId: Map<number, number>,
): StockBalanceVariant {
    const reservedQuantity = reservedByVariantId.get(variant.id) ?? 0;

    return {
        ...variant,
        reservedQuantity,
        availableQuantity: getAvailableQuantity(variant.quantity, reservedQuantity),
    };
}

function getTotalQuantity(item: LoadedStockBalanceItem): number {
    if (item.variants.length === 0) {
        return item.quantity;
    }

    return item.variants.reduce((sum, variant) => sum + variant.quantity, 0);
}

export async function getStockBalanceReportMeta(): Promise<{
    count: number;
    maxRows: number;
}> {
    const count = await prisma.stockItem.count({
        where: { isActive: true },
    });

    return {
        count,
        maxRows: EXPORT_LIMITS.stock.maxRows,
    };
}

export async function createStockBalanceReportXlsxResponse(): Promise<Response> {
    const meta = await getStockBalanceReportMeta();
    if (meta.count > meta.maxRows) {
        throw new Error(
            `ส่งออกยอดคงเหลือสต๊อกได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง`,
        );
    }

    const items = await loadActiveStockItems();
    const workbook = createStockBalanceReportWorkbook(items);
    const filename = generateFilename("ยอดคงเหลือสต๊อกปัจจุบัน", "xlsx");

    return createXlsxDownloadResponse(filename, workbook);
}
