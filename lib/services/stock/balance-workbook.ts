import ExcelJS from "exceljs";

import { finishStockWorksheet } from "@/lib/services/stock/workbook-style";

const BALANCE_SHEET_NAME = "ยอดคงเหลือจริง";

export type StockBalanceVariant = {
    id: number;
    unit: string;
    quantity: number;
    minStock: number;
    reservedQuantity: number;
    availableQuantity: number;
    attributeValues?: Array<{
        attributeValue: {
            value: string;
            attribute: { name: string };
        };
    }>;
};

export type StockBalanceItem = {
    id: number;
    name: string;
    description: string | null;
    unit: string;
    quantity: number;
    minStock: number;
    reservedQuantity: number;
    availableQuantity: number;
    category: { name: string };
    variants: StockBalanceVariant[];
};

type StockBalanceVariantRow = {
    categoryName: string;
    itemName: string;
    variantSummary: string;
    unit: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minStock: number;
    stockLevel: string;
};

export function createStockBalanceReportWorkbook(
    items: StockBalanceItem[],
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "NHF Employee";
    workbook.created = new Date();
    addBalanceSheet(workbook, buildVariantRows(items));

    return workbook;
}

function addBalanceSheet(
    workbook: ExcelJS.Workbook,
    rows: StockBalanceVariantRow[],
): void {
    const sheet = workbook.addWorksheet(BALANCE_SHEET_NAME);
    sheet.columns = getBalanceColumns();
    sheet.addRows(rows);
    finishStockWorksheet(sheet, 3);
}

function buildVariantRows(items: StockBalanceItem[]): StockBalanceVariantRow[] {
    return items
        .flatMap((item) =>
            resolveBalanceVariants(item).map((variant) => toVariantRow(item, variant)),
        )
        .sort(compareVariantRows);
}

function toVariantRow(
    item: StockBalanceItem,
    variant: StockBalanceVariant,
): StockBalanceVariantRow {
    return {
        categoryName: item.category.name,
        itemName: item.name,
        variantSummary: formatVariantSummary(variant.attributeValues),
        unit: variant.unit,
        quantity: variant.quantity,
        reservedQuantity: variant.reservedQuantity,
        availableQuantity: variant.availableQuantity,
        minStock: variant.minStock,
        stockLevel: resolveStockLevel(variant.availableQuantity, variant.minStock),
    };
}

function resolveBalanceVariants(item: StockBalanceItem): StockBalanceVariant[] {
    if (item.variants.length > 0) {
        return item.variants;
    }

    return [
        {
            id: item.id,
            unit: item.unit,
            quantity: item.quantity,
            minStock: item.minStock,
            reservedQuantity: item.reservedQuantity,
            availableQuantity: item.availableQuantity,
            attributeValues: [],
        },
    ];
}

function formatVariantSummary(
    attributeValues: StockBalanceVariant["attributeValues"],
): string {
    if (!attributeValues || attributeValues.length === 0) {
        return "-";
    }

    return attributeValues
        .map(
            (attributeValue) =>
                `${attributeValue.attributeValue.attribute.name}: ${attributeValue.attributeValue.value}`,
        )
        .join(" • ");
}

function resolveStockLevel(availableQuantity: number, minStock: number): string {
    return availableQuantity <= minStock ? "ต่ำกว่าจุดสั่งซื้อ" : "ปกติ";
}

function compareVariantRows(
    left: StockBalanceVariantRow,
    right: StockBalanceVariantRow,
): number {
    return left.categoryName.localeCompare(right.categoryName, "th")
        || left.itemName.localeCompare(right.itemName, "th")
        || left.variantSummary.localeCompare(right.variantSummary, "th");
}

function getBalanceColumns(): Partial<ExcelJS.Column>[] {
    return [
        { header: "หมวดหมู่", key: "categoryName", width: 22 },
        { header: "ชื่อวัสดุ", key: "itemName", width: 28 },
        { header: "รายการย่อย", key: "variantSummary", width: 30 },
        { header: "หน่วย", key: "unit", width: 12 },
        { header: "คงเหลือจริง", key: "quantity", width: 14 },
        { header: "จองรอจ่าย", key: "reservedQuantity", width: 14 },
        { header: "พร้อมใช้", key: "availableQuantity", width: 12 },
        { header: "จุดสั่งซื้อ", key: "minStock", width: 14 },
        { header: "สถานะสต๊อก", key: "stockLevel", width: 18 },
    ];
}
