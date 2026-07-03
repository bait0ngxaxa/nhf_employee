import ExcelJS from "exceljs";

import { finishStockWorksheet } from "@/lib/services/stock/workbook-style";

const SUMMARY_SHEET_NAME = "สรุปการใช้วัสดุ";
const DETAIL_SHEET_NAME = "รายละเอียดที่ใช้คำนวณ";
const DATE_TIME_KEYS = new Set(["issuedAt", "latestIssuedAt"]);

export type StockRequestReportItem = {
    quantity: number;
    item: {
        id: number;
        name: string;
        unit: string;
        category: { name: string };
    };
    variant: {
        id: number;
        unit: string;
        attributeValues: Array<{
            attributeValue: { value: string; attribute: { name: string } };
        }>;
    } | null;
};

export type StockRequestReportRequest = {
    id: number;
    createdAt: Date;
    projectCode: string;
    issuedAt: Date;
    requester: { name: string; email: string };
    issuer: { name: string } | null;
    items: StockRequestReportItem[];
};

type StockRequestVariantAttributeValues =
    NonNullable<StockRequestReportItem["variant"]>["attributeValues"];

type StockRequestSummaryRow = {
    categoryName: string;
    itemName: string;
    variantSummary: string;
    unit: string;
    issueCount: number;
    totalIssuedQuantity: number;
    projectCount: number;
    latestIssuedAt: Date;
};

type StockRequestCalculationRow = {
    sequence: number;
    issuedAt: Date;
    requestNumber: number;
    projectCode: string;
    requesterName: string;
    requesterEmail: string;
    issuerName: string;
    categoryName: string;
    itemName: string;
    variantSummary: string;
    quantity: number;
    unit: string;
    groupKey: string;
};

type StockRequestDetailRow = {
    sequence: number;
    issuedAt: Date;
    requestNumber: number;
    projectCode: string;
    requesterName: string;
    requesterEmail: string;
    issuerName: string;
    itemSummary: string;
    itemTypeCount: number;
    totalQuantity: number;
};

type SummaryAccumulator = Omit<
    StockRequestSummaryRow,
    "issueCount" | "projectCount"
> & {
    requestIds: Set<number>;
    projectCodes: Set<string>;
};

export function createStockRequestReportWorkbook(
    requests: StockRequestReportRequest[],
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const calculationRows = buildCalculationRows(requests);

    workbook.creator = "NHF Employee";
    workbook.created = new Date();
    addSummarySheet(workbook, buildSummaryRows(calculationRows));
    addDetailSheet(workbook, buildDetailRows(requests));

    return workbook;
}

function addSummarySheet(
    workbook: ExcelJS.Workbook,
    rows: StockRequestSummaryRow[],
): void {
    const sheet = workbook.addWorksheet(SUMMARY_SHEET_NAME);
    sheet.columns = getSummaryColumns();
    sheet.addRows(rows);
    finishStockWorksheet(sheet, 4, DATE_TIME_KEYS);
}

function addDetailSheet(
    workbook: ExcelJS.Workbook,
    rows: StockRequestDetailRow[],
): void {
    const sheet = workbook.addWorksheet(DETAIL_SHEET_NAME);
    sheet.columns = getDetailColumns();
    sheet.addRows(rows);
    finishStockWorksheet(sheet, 4, DATE_TIME_KEYS);
}

function buildCalculationRows(
    requests: StockRequestReportRequest[],
): StockRequestCalculationRow[] {
    return requests
        .flatMap((request) => request.items.map((item) => toCalculationRow(request, item)))
        .map((row, index) => ({ ...row, sequence: index + 1 }));
}

function buildDetailRows(requests: StockRequestReportRequest[]): StockRequestDetailRow[] {
    return requests.map((request, index) => toDetailRow(request, index + 1));
}

function buildSummaryRows(
    detailRows: StockRequestCalculationRow[],
): StockRequestSummaryRow[] {
    const summaries = new Map<string, SummaryAccumulator>();
    for (const row of detailRows) {
        const summary = getOrCreateSummary(summaries, row);
        addDetailToSummary(summary, row);
    }

    return Array.from(summaries.values()).map(toSummaryRow).sort(compareSummaryRows);
}

function toCalculationRow(
    request: StockRequestReportRequest,
    item: StockRequestReportItem,
): Omit<StockRequestCalculationRow, "sequence"> {
    return {
        issuedAt: request.issuedAt,
        requestNumber: request.id,
        projectCode: request.projectCode,
        requesterName: request.requester.name,
        requesterEmail: request.requester.email,
        issuerName: request.issuer?.name ?? "-",
        categoryName: item.item.category.name,
        itemName: item.item.name,
        variantSummary: formatVariantSummary(item.variant?.attributeValues),
        quantity: item.quantity,
        unit: item.variant?.unit ?? item.item.unit,
        groupKey: createItemVariantKey(item),
    };
}

function toDetailRow(
    request: StockRequestReportRequest,
    sequence: number,
): StockRequestDetailRow {
    return {
        sequence,
        issuedAt: request.issuedAt,
        requestNumber: request.id,
        projectCode: request.projectCode,
        requesterName: request.requester.name,
        requesterEmail: request.requester.email,
        issuerName: request.issuer?.name ?? "-",
        itemSummary: formatItemsSummary(request.items),
        itemTypeCount: request.items.length,
        totalQuantity: sumRequestQuantity(request.items),
    };
}

function getOrCreateSummary(
    summaries: Map<string, SummaryAccumulator>,
    row: StockRequestCalculationRow,
): SummaryAccumulator {
    const existing = summaries.get(row.groupKey);
    if (existing) {
        return existing;
    }

    const summary = createEmptySummary(row);
    summaries.set(row.groupKey, summary);
    return summary;
}

function createEmptySummary(row: StockRequestCalculationRow): SummaryAccumulator {
    return {
        categoryName: row.categoryName,
        itemName: row.itemName,
        variantSummary: row.variantSummary,
        unit: row.unit,
        totalIssuedQuantity: 0,
        latestIssuedAt: row.issuedAt,
        requestIds: new Set(),
        projectCodes: new Set(),
    };
}

function addDetailToSummary(
    summary: SummaryAccumulator,
    row: StockRequestCalculationRow,
): void {
    summary.totalIssuedQuantity += row.quantity;
    summary.requestIds.add(row.requestNumber);
    summary.projectCodes.add(row.projectCode);
    summary.latestIssuedAt = getLatestDate(summary.latestIssuedAt, row.issuedAt);
}

function toSummaryRow(summary: SummaryAccumulator): StockRequestSummaryRow {
    return {
        categoryName: summary.categoryName,
        itemName: summary.itemName,
        variantSummary: summary.variantSummary,
        unit: summary.unit,
        issueCount: summary.requestIds.size,
        totalIssuedQuantity: summary.totalIssuedQuantity,
        projectCount: summary.projectCodes.size,
        latestIssuedAt: summary.latestIssuedAt,
    };
}

function createItemVariantKey(item: StockRequestReportItem): string {
    return item.variant ? `variant:${item.variant.id}` : `item:${item.item.id}`;
}

function formatVariantSummary(
    attributeValues: StockRequestVariantAttributeValues | undefined,
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

function formatItemsSummary(items: StockRequestReportItem[]): string {
    return items.map(formatItemSummary).join(" | ");
}

function formatItemSummary(item: StockRequestReportItem): string {
    const unit = item.variant?.unit ?? item.item.unit;
    const variantSummary = formatVariantSummary(item.variant?.attributeValues);

    return `${item.item.name} (${variantSummary}) x${item.quantity} ${unit}`;
}

function sumRequestQuantity(items: StockRequestReportItem[]): number {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}

function getLatestDate(left: Date, right: Date): Date {
    return left.getTime() >= right.getTime() ? left : right;
}

function compareSummaryRows(
    left: StockRequestSummaryRow,
    right: StockRequestSummaryRow,
): number {
    return left.categoryName.localeCompare(right.categoryName, "th")
        || left.itemName.localeCompare(right.itemName, "th")
        || left.variantSummary.localeCompare(right.variantSummary, "th");
}

function getSummaryColumns(): Partial<ExcelJS.Column>[] {
    return [
        { header: "หมวดหมู่", key: "categoryName", width: 22 },
        { header: "ชื่อวัสดุ", key: "itemName", width: 28 },
        { header: "รายการย่อย", key: "variantSummary", width: 30 },
        { header: "หน่วย", key: "unit", width: 12 },
        { header: "จำนวนครั้งที่เบิก", key: "issueCount", width: 18 },
        { header: "จำนวนรวมที่จ่ายจริง", key: "totalIssuedQuantity", width: 22 },
        { header: "จำนวนโครงการที่ใช้", key: "projectCount", width: 20 },
        { header: "วันที่จ่ายล่าสุด", key: "latestIssuedAt", width: 18 },
    ];
}

function getDetailColumns(): Partial<ExcelJS.Column>[] {
    return [
        { header: "ลำดับ", key: "sequence", width: 8 },
        { header: "วันที่จ่าย", key: "issuedAt", width: 18 },
        { header: "เลขที่คำขอ", key: "requestNumber", width: 14 },
        { header: "รหัสโครงการ", key: "projectCode", width: 18 },
        { header: "ผู้ขอ", key: "requesterName", width: 24 },
        { header: "อีเมลผู้ขอ", key: "requesterEmail", width: 28 },
        { header: "ผู้จ่าย", key: "issuerName", width: 20 },
        { header: "รายการวัสดุที่จ่าย", key: "itemSummary", width: 54 },
        { header: "จำนวนชนิดวัสดุ", key: "itemTypeCount", width: 16 },
        { header: "จำนวนรวม", key: "totalQuantity", width: 14 },
    ];
}
