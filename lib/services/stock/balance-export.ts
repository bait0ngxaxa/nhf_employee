import { StockRequestStatus } from "@prisma/client";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { prisma } from "@/lib/prisma";
import { createCsvDownloadResponse, encodeCsvRow } from "@/lib/server/csv";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import {
    buildItemInclude,
    buildReservedQuantityMaps,
    ensureItemVariantsExist,
    getAvailableQuantity,
} from "./shared";

type ExportStockVariant = {
    id: number;
    unit: string;
    quantity: number;
    minStock: number;
    availableQuantity: number;
    attributeValues?: Array<{
        attributeValue: {
            value: string;
            attribute: { name: string };
        };
    }>;
};

type ExportStockItem = {
    id: number;
    name: string;
    description: string | null;
    unit: string;
    quantity: number;
    minStock: number;
    reservedQuantity: number;
    availableQuantity: number;
    category: { name: string };
    variants: ExportStockVariant[];
};

function formatVariantSummary(
    attributeValues: ExportStockVariant["attributeValues"],
): string {
    if (!attributeValues || attributeValues.length === 0) {
        return "";
    }

    return attributeValues
        .map(
            (attributeValue) =>
                `${attributeValue.attributeValue.attribute.name}: ${attributeValue.attributeValue.value}`,
        )
        .join(" • ");
}

function summarizeItemInventory(item: ExportStockItem): {
    quantity: number;
    minStock: number;
    unit: string;
} {
    if (item.variants.length === 0) {
        return {
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
        };
    }

    const quantity = item.variants.reduce((sum, variant) => sum + variant.quantity, 0);
    const minStock = item.variants.reduce((sum, variant) => sum + variant.minStock, 0);
    const units = Array.from(new Set(item.variants.map((variant) => variant.unit.trim())));

    return {
        quantity,
        minStock,
        unit: units.length === 1 ? (units[0] ?? item.unit) : item.unit,
    };
}

function formatVariantBalances(variants: ExportStockVariant[]): string {
    if (variants.length <= 1) {
        return "-";
    }

    return variants
        .map((variant) => {
            const label = formatVariantSummary(variant.attributeValues);
            const prefix = label ? `${label} ` : "";
            return `${prefix}คงเหลือ ${variant.quantity} ${variant.unit} พร้อมใช้ ${variant.availableQuantity}`;
        })
        .join(" | ");
}

function resolveStockLevel(quantity: number, minStock: number): string {
    return quantity <= minStock ? "ต่ำกว่าจุดสั่งซื้อ" : "ปกติ";
}

async function loadActiveStockItems(): Promise<ExportStockItem[]> {
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

    const itemIds = items.map((item) => item.id);
    const pendingRequestItems =
        itemIds.length > 0
            ? await prisma.stockRequestItem.findMany({
                  where: {
                      itemId: { in: itemIds },
                      request: { status: StockRequestStatus.PENDING_ISSUE },
                  },
                  select: {
                      itemId: true,
                      variantId: true,
                      quantity: true,
                  },
              })
            : [];
    const defaultVariantIdByItemId = new Map(
        items
            .map((item) => [item.id, item.variants[0]?.id] as const)
            .filter((entry): entry is readonly [number, number] => entry[1] !== undefined),
    );
    const { reservedByItemId, reservedByVariantId } = buildReservedQuantityMaps(
        pendingRequestItems,
        defaultVariantIdByItemId,
    );

    return items.map((item) => {
        const reservedQuantity = reservedByItemId.get(item.id) ?? 0;
        const totalQuantity =
            item.variants.length > 0
                ? item.variants.reduce((sum, variant) => sum + variant.quantity, 0)
                : item.quantity;

        return {
            ...item,
            reservedQuantity,
            availableQuantity: getAvailableQuantity(totalQuantity, reservedQuantity),
            variants: item.variants.map((variant) => {
                const variantReservedQuantity = reservedByVariantId.get(variant.id) ?? 0;

                return {
                    ...variant,
                    availableQuantity: getAvailableQuantity(
                        variant.quantity,
                        variantReservedQuantity,
                    ),
                };
            }),
        };
    });
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

export async function createStockBalanceReportCsvResponse(): Promise<Response> {
    const meta = await getStockBalanceReportMeta();
    if (meta.count > meta.maxRows) {
        throw new Error(
            `ส่งออกยอดคงเหลือสต๊อกได้ไม่เกิน ${meta.maxRows} รายการต่อครั้ง`,
        );
    }

    const items = await loadActiveStockItems();

    return createCsvDownloadResponse(
        generateFilename("ยอดคงเหลือสต๊อกปัจจุบัน", "csv"),
        async (controller) => {
            controller.enqueue(
                encodeCsvRow([
                    "หมวดหมู่",
                    "ชื่อวัสดุ",
                    "คำอธิบาย",
                    "ยอดคงเหลือ",
                    "จองรอจ่าย",
                    "พร้อมใช้",
                    "จุดสั่งซื้อ",
                    "หน่วย",
                    "สถานะสต๊อก",
                    "รายละเอียดรายการย่อย",
                ]),
            );

            for (const item of items) {
                const inventory = summarizeItemInventory(item);

                controller.enqueue(
                    encodeCsvRow([
                        item.category.name,
                        item.name,
                        item.description ?? "-",
                        inventory.quantity,
                        item.reservedQuantity,
                        item.availableQuantity,
                        inventory.minStock,
                        inventory.unit,
                        resolveStockLevel(inventory.quantity, inventory.minStock),
                        formatVariantBalances(item.variants),
                    ]),
                );
            }
        },
    );
}
