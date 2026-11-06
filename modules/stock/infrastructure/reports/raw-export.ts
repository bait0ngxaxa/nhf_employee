import ExcelJS from "exceljs";
import { Prisma, StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import { toBangkokExcelDate } from "@/lib/helpers/bangkok-time";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { getUserDisplayName } from "@/shared/identity/display";
import { stockAnalyticsQuerySchema, stockReportingPeriod, type StockAnalyticsQuery } from "../../schemas/analytics";
import { classifyStockHealth } from "../../domain/analytics";
import { getAvailableQuantity } from "../persistence/shared";
import { StockInvariantViolationError } from "../../domain/errors";
import { finishStockWorksheet } from "./workbook-style";

export class StockRawExportLimitError extends Error {
    constructor() { super(`ส่งออกข้อมูลดิบได้ไม่เกิน ${EXPORT_LIMITS.stock.maxRows} แถวต่อครั้ง กรุณาลดช่วงข้อมูล`); }
}

export function issuedRawWhere(query: StockAnalyticsQuery): Prisma.StockRequestItemWhereInput {
    const { start, end } = stockReportingPeriod(query);
    return {
        request: { status: StockRequestStatus.ISSUED, issuedAt: { gte: start, lt: end }, ...(query.projectCode ? { projectCode: query.projectCode } : {}) },
        ...(query.categoryId === undefined ? {} : { item: { categoryId: query.categoryId } }),
    };
}

export async function getStockRawExportCategories(): Promise<{ id: number; name: string }[]> {
    return prisma.stockCategory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function createStockRawDataWorkbook(input: unknown, mode: "raw-issued" | "raw-inventory"): Promise<ExcelJS.Workbook> {
    const query = stockAnalyticsQuerySchema.parse(input);
    return prisma.$transaction(async (tx) => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "NHF Employee";
        workbook.created = new Date();
        if (mode === "raw-issued") await addIssuedSheet(tx, workbook, query);
        else await addInventorySheet(tx, workbook);
        return workbook;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}

export async function createStockRawDataXlsxResponse(input: unknown, mode: "raw-issued" | "raw-inventory"): Promise<Response> {
    const workbook = await createStockRawDataWorkbook(input, mode);
    return createXlsxDownloadResponse(generateFilename(mode === "raw-issued" ? "ข้อมูลดิบการจ่ายวัสดุ" : "ข้อมูลดิบคลังปัจจุบัน", "xlsx"), workbook);
}

async function addIssuedSheet(tx: Prisma.TransactionClient, workbook: ExcelJS.Workbook, query: StockAnalyticsQuery): Promise<void> {
    // Read one overflow row within the same snapshot instead of a racy count/load pair.
    const rows = await tx.stockRequestItem.findMany({
        where: issuedRawWhere(query), take: EXPORT_LIMITS.stock.maxRows + 1, orderBy: [{ request: { issuedAt: "asc" } }, { id: "asc" }],
        select: { id: true, itemId: true, variantId: true, quantity: true,
            item: { select: { name: true, sku: true, unit: true, category: { select: { name: true } } } },
            variant: { select: { sku: true, unit: true, attributeValues: { select: { attributeValue: { select: { value: true, attribute: { select: { name: true } } } } } } } },
            request: { select: { id: true, issuedAt: true, projectCode: true, requester: { select: { name: true, employee: { select: { firstName: true, lastName: true, nickname: true } } } }, issuer: { select: { name: true, employee: { select: { firstName: true, lastName: true, nickname: true } } } } } },
        },
    });
    if (rows.length > EXPORT_LIMITS.stock.maxRows) throw new StockRawExportLimitError();
    const sheet = workbook.addWorksheet("ข้อมูลดิบการจ่าย");
    sheet.columns = columns(["วันที่จ่าย (เวลาไทย)", "เลขที่คำขอ", "รหัสโครงการ", "ผู้ขอ", "ผู้จ่าย", "รหัสรายการ", "รหัสวัสดุ", "ชื่อวัสดุ", "หมวด", "SKU", "รหัส variant", "คุณลักษณะ", "ปริมาณที่จ่าย", "หน่วย"]);
    for (const row of rows) sheet.addRow([
        row.request.issuedAt ? toBangkokExcelDate(row.request.issuedAt) : null,
        row.request.id, row.request.projectCode, getUserDisplayName(row.request.requester), row.request.issuer ? getUserDisplayName(row.request.issuer) : "-",
        row.id, row.itemId, row.item.name, row.item.category.name, row.variant?.sku ?? row.item.sku, row.variantId,
        row.variant?.attributeValues.map((a) => `${a.attributeValue.attribute.name}: ${a.attributeValue.value}`).sort().join(", ") ?? "รายการเดิมไม่มี variant",
        row.quantity, row.variant?.unit ?? row.item.unit,
    ]);
    finishStockWorksheet(sheet, 3, new Set(["column0"]));
}

async function addInventorySheet(tx: Prisma.TransactionClient, workbook: ExcelJS.Workbook): Promise<void> {
    const invalid = await tx.stockRequestItem.findFirst({ where: { variantId: null, request: { status: StockRequestStatus.PENDING_ISSUE } }, select: { id: true } });
    if (invalid) throw new StockInvariantViolationError("พบคำขอรอจ่ายที่ไม่มี variant snapshot");
    const rows = await tx.stockItemVariant.findMany({ where: { isActive: true, stockItem: { isActive: true } }, take: EXPORT_LIMITS.stock.maxRows + 1, orderBy: { id: "asc" },
        select: { id: true, stockItemId: true, sku: true, unit: true, quantity: true, minStock: true,
            stockItem: { select: { sku: true, name: true, category: { select: { name: true } } } },
            attributeValues: { select: { attributeValue: { select: { value: true, attribute: { select: { name: true } } } } } },
        },
    });
    if (rows.length > EXPORT_LIMITS.stock.maxRows) throw new StockRawExportLimitError();
    const reservations = rows.length ? await tx.stockRequestItem.groupBy({ by: ["variantId"], where: { variantId: { in: rows.map((r) => r.id) }, request: { status: StockRequestStatus.PENDING_ISSUE } }, _sum: { quantity: true } }) : [];
    const reserved = new Map(reservations.map((r) => [r.variantId, r._sum.quantity ?? 0]));
    const sheet = workbook.addWorksheet("ข้อมูลดิบคลังปัจจุบัน");
    sheet.columns = columns(["รหัสวัสดุ", "รหัส variant", "SKU วัสดุ", "SKU variant", "หมวด", "ชื่อวัสดุ", "คุณลักษณะ", "หน่วย", "คงเหลือจริง", "จองรอจ่าย", "พร้อมใช้", "จุดสั่งซื้อ", "สถานะ"]);
    const labels = { healthy: "ปกติ", low: "ใกล้หมด", out: "หมดสต็อก" };
    for (const row of rows) {
        const held = reserved.get(row.id) ?? 0;
        const available = getAvailableQuantity(row.quantity, held);
        sheet.addRow([row.stockItemId, row.id, row.stockItem.sku, row.sku, row.stockItem.category.name, row.stockItem.name,
            row.attributeValues.map((a) => `${a.attributeValue.attribute.name}: ${a.attributeValue.value}`).sort().join(", "),
            row.unit, row.quantity, held, available, row.minStock, labels[classifyStockHealth(available, row.minStock)],
        ]);
    }
    finishStockWorksheet(sheet, 4);
}

function columns(headers: string[]): Partial<ExcelJS.Column>[] {
    return headers.map((header, index) => ({ header, key: `column${index}`, width: index === 0 ? 24 : 22 }));
}
