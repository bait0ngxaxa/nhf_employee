import { StockRequestStatus, type Prisma } from "@prisma/client";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { prisma } from "@/lib/db/prisma";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import {
    createStockRequestReportWorkbook,
    type StockRequestReportRequest,
} from "@/lib/services/stock/report-workbook";

const STOCK_REQUEST_REPORT_SELECT = {
    id: true,
    createdAt: true,
    projectCode: true,
    issuedAt: true,
    requester: { select: { name: true, email: true } },
    issuer: { select: { name: true } },
    items: {
        select: {
            quantity: true,
            item: {
                select: {
                    id: true,
                    name: true,
                    unit: true,
                    category: { select: { name: true } },
                },
            },
            variant: {
                select: {
                    id: true,
                    unit: true,
                    attributeValues: {
                        select: {
                            attributeValue: {
                                select: {
                                    value: true,
                                    attribute: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
} satisfies Prisma.StockRequestSelect;

function createYearRange(year: number): { startOfYear: Date; endOfYear: Date } {
    return {
        startOfYear: new Date(`${year}-01-01T00:00:00.000Z`),
        endOfYear: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
}

export async function getStockRequestReportYears(): Promise<number[]> {
    const rows = await prisma.stockRequest.findMany({
        where: {
            status: StockRequestStatus.ISSUED,
            issuedAt: { not: null },
        },
        select: { issuedAt: true },
        distinct: ["issuedAt"],
    });

    const years = new Set(
        rows.flatMap((row) => (row.issuedAt ? [row.issuedAt.getFullYear()] : [])),
    );
    years.add(new Date().getFullYear());

    return Array.from(years).sort((left, right) => right - left);
}

export async function getStockRequestReportMeta(year: number): Promise<{
    count: number;
    maxRows: number;
}> {
    const count = await prisma.stockRequestItem.count({
        where: { request: createIssuedRequestWhere(year) },
    });

    return {
        count,
        maxRows: EXPORT_LIMITS.stock.maxRows,
    };
}

export async function createStockRequestReportXlsxResponse(
    year: number,
): Promise<Response> {
    const where = createIssuedRequestWhere(year);
    const recordCount = await prisma.stockRequestItem.count({
        where: { request: where },
    });

    if (recordCount > EXPORT_LIMITS.stock.maxRows) {
        throw new Error(
            `ส่งออกรายงานเบิกวัสดุได้ไม่เกิน ${EXPORT_LIMITS.stock.maxRows} รายการต่อครั้ง`,
        );
    }

    const requests = await loadStockRequestReportRequests(where);
    const workbook = createStockRequestReportWorkbook(requests);
    const filename = generateFilename(`รายงานเบิกวัสดุ_ปี-${year}`, "xlsx");

    return createXlsxDownloadResponse(filename, workbook);
}

async function loadStockRequestReportRequests(
    where: Prisma.StockRequestWhereInput,
): Promise<StockRequestReportRequest[]> {
    const requests = await prisma.stockRequest.findMany({
        where,
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
        select: STOCK_REQUEST_REPORT_SELECT,
    });

    return requests.flatMap((request) =>
        request.issuedAt ? [{ ...request, issuedAt: request.issuedAt }] : [],
    );
}

function createIssuedRequestWhere(year: number): Prisma.StockRequestWhereInput {
    const { startOfYear, endOfYear } = createYearRange(year);
    return {
        status: StockRequestStatus.ISSUED,
        issuedAt: { gte: startOfYear, lt: endOfYear },
    };
}
