import type { StockRequestStatus } from "@prisma/client";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { prisma } from "@/lib/prisma";
import { createCsvDownloadResponse, encodeCsvRow } from "@/lib/server/csv";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";

const STOCK_STATUS_LABELS: Record<StockRequestStatus, string> = {
    PENDING_ISSUE: "รอจ่าย",
    ISSUED: "จ่ายแล้ว",
    CANCELLED: "ยกเลิก",
    REJECTED_LEGACY: "ปฏิเสธ (เดิม)",
};

const PROCESSED_STATUSES: StockRequestStatus[] = [
    "ISSUED",
    "CANCELLED",
    "REJECTED_LEGACY",
];

function createYearRange(year: number): { startOfYear: Date; endOfYear: Date } {
    return {
        startOfYear: new Date(`${year}-01-01T00:00:00.000Z`),
        endOfYear: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
}

function formatDateTime(value: Date | null): string {
    if (!value) {
        return "-";
    }

    return value.toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
    });
}

function formatVariantSummary(
    attributeValues:
        | Array<{
              attributeValue: {
                  value: string;
                  attribute: { name: string };
              };
          }>
        | undefined,
): string {
    if (!attributeValues || attributeValues.length === 0) {
        return "";
    }

    return attributeValues
        .map((attributeValue) =>
            `${attributeValue.attributeValue.attribute.name}: ${attributeValue.attributeValue.value}`,
        )
        .join(", ");
}

type RequestItem = {
    quantity: number;
    item: { name: string; unit: string };
    variant: {
        unit: string;
        attributeValues: Array<{
            attributeValue: { value: string; attribute: { name: string } };
        }>;
    } | null;
};

/** Collapses all items in a request into one readable cell, e.g. "ปากกา x2 ชิ้น | กระดาษ x10 แผ่น" */
function formatItemsSummary(items: RequestItem[]): string {
    return items
        .map((requestItem) => {
            const name = requestItem.item.name;
            const unit = requestItem.variant?.unit ?? requestItem.item.unit;
            const qty = requestItem.quantity;
            const attrs = formatVariantSummary(requestItem.variant?.attributeValues);
            return attrs
                ? `${name} (${attrs}) x${qty} ${unit}`
                : `${name} x${qty} ${unit}`;
        })
        .join(" | ");
}

export async function getStockRequestReportYears(): Promise<number[]> {
    const rows = await prisma.stockRequest.findMany({
        where: {
            status: { in: PROCESSED_STATUSES },
        },
        select: { createdAt: true },
        distinct: ["createdAt"],
    });

    const years = new Set(rows.map((row) => new Date(row.createdAt).getFullYear()));
    years.add(new Date().getFullYear());

    return Array.from(years).sort((left, right) => right - left);
}

export async function getStockRequestReportMeta(year: number): Promise<{
    count: number;
    maxRows: number;
}> {
    const { startOfYear, endOfYear } = createYearRange(year);

    const count = await prisma.stockRequest.count({
        where: {
            createdAt: {
                gte: startOfYear,
                lt: endOfYear,
            },
            status: { in: PROCESSED_STATUSES },
        },
    });

    return {
        count,
        maxRows: EXPORT_LIMITS.stock.maxRows,
    };
}

export async function createStockRequestReportCsvResponse(
    year: number,
): Promise<Response> {
    const { startOfYear, endOfYear } = createYearRange(year);
    const where = {
        createdAt: {
            gte: startOfYear,
            lt: endOfYear,
        },
        status: { in: PROCESSED_STATUSES as StockRequestStatus[] },
    };
    const recordCount = await prisma.stockRequest.count({ where });

    if (recordCount > EXPORT_LIMITS.stock.maxRows) {
        throw new Error(
            `ส่งออกรายงานเบิกวัสดุได้ไม่เกิน ${EXPORT_LIMITS.stock.maxRows} รายการต่อครั้ง`,
        );
    }

    return createCsvDownloadResponse(
        generateFilename(`รายงานเบิกวัสดุ_ปี-${year}`, "csv"),
        async (controller) => {
            controller.enqueue(
                encodeCsvRow([
                    "เลขที่คำขอ",
                    "วันที่ยื่น",
                    "รหัสโครงการ",
                    "สถานะ",
                    "ผู้ขอ",
                    "อีเมลผู้ขอ",
                    "รายการวัสดุ",
                    "ผู้จ่าย",
                    "วันที่จ่าย",
                    "ผู้ยกเลิก",
                    "วันที่ยกเลิก",
                    "เหตุผลยกเลิก",
                ]),
            );

            for (let offset = 0; offset < recordCount; offset += EXPORT_LIMITS.stock.batchSize) {
                const requests = await prisma.stockRequest.findMany({
                    where,
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    skip: offset,
                    take: EXPORT_LIMITS.stock.batchSize,
                    select: {
                        id: true,
                        createdAt: true,
                        projectCode: true,
                        status: true,
                        issuedAt: true,
                        cancelReason: true,
                        cancelledAt: true,
                        requester: { select: { name: true, email: true } },
                        issuer: { select: { name: true } },
                        canceller: { select: { name: true } },
                        items: {
                            select: {
                                quantity: true,
                                item: { select: { name: true, unit: true } },
                                variant: {
                                    select: {
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
                    },
                });

                for (const request of requests) {
                    controller.enqueue(
                        encodeCsvRow([
                            request.id,
                            formatDateTime(request.createdAt),
                            request.projectCode,
                            STOCK_STATUS_LABELS[request.status] ?? request.status,
                            request.requester.name,
                            request.requester.email,
                            formatItemsSummary(request.items),
                            request.issuer?.name ?? "-",
                            formatDateTime(request.issuedAt),
                            request.canceller?.name ?? "-",
                            formatDateTime(request.cancelledAt),
                            request.cancelReason ?? "-",
                        ]),
                    );
                }
            }
        },
    );
}
