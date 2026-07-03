import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/db/prisma";
import { createStockBalanceReportXlsxResponse } from "@/lib/services/stock/balance-export";
import { createStockRequestReportXlsxResponse } from "@/lib/services/stock/report-export";
import { ensureItemVariantsExist } from "@/lib/services/stock/shared";
import type * as StockSharedModule from "@/lib/services/stock/shared";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/services/stock/shared", async () => {
    const actual =
        await vi.importActual<typeof StockSharedModule>(
            "@/lib/services/stock/shared",
        );

    return {
        ...actual,
        ensureItemVariantsExist: vi.fn(),
    };
});

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

async function loadWorkbook(response: Response): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    const buffer = await response.arrayBuffer();
    await workbook.xlsx.load(buffer);
    return workbook;
}

function collectWorkbookText(workbook: ExcelJS.Workbook): string {
    const values: string[] = [];
    workbook.eachSheet((sheet) => {
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                values.push(String(cell.value ?? ""));
            });
        });
    });
    return values.join("|");
}

function findRowByCellValue(
    sheet: ExcelJS.Worksheet | undefined,
    column: number,
    value: string,
): ExcelJS.Row | undefined {
    let foundRow: ExcelJS.Row | undefined;
    sheet?.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && row.getCell(column).value === value) {
            foundRow = row;
        }
    });
    return foundRow;
}

function bangkokExcelDate(isoDate: string): Date {
    return new Date(new Date(isoDate).getTime() + 7 * 60 * 60 * 1000);
}

describe("Stock report export services", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(ensureItemVariantsExist).mockReset();
    });

    it("should export stock request xlsx with summary and detail sheets", async () => {
        prismaMock.stockRequestItem.count.mockResolvedValue(asNever(3));
        prismaMock.stockRequest.findMany.mockResolvedValue(
            asNever([
                {
                    id: 100,
                    createdAt: new Date("2031-02-19T01:02:03.000Z"),
                    projectCode: "PRJ-2031-B",
                    issuedAt: new Date("2031-02-20T01:02:03.000Z"),
                    requester: { name: "สุดา", email: "suda@test.com" },
                    issuer: { name: "ผู้จ่าย" },
                    items: [
                        {
                            quantity: 3,
                            item: {
                                id: 1,
                                name: "ปากกา",
                                unit: "ด้าม",
                                category: { name: "เครื่องเขียน" },
                            },
                            variant: {
                                id: 11,
                                unit: "ด้าม",
                                attributeValues: [
                                    {
                                        attributeValue: {
                                            value: "แดง",
                                            attribute: { name: "สี" },
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
                {
                    id: 99,
                    createdAt: new Date("2031-02-03T01:02:03.000Z"),
                    projectCode: "PRJ-2031-A",
                    issuedAt: new Date("2031-02-04T01:02:03.000Z"),
                    requester: { name: "สมชาย", email: "somchai@test.com" },
                    issuer: { name: "ผู้จ่าย" },
                    items: [
                        {
                            quantity: 2,
                            item: {
                                id: 1,
                                name: "ปากกา",
                                unit: "ด้าม",
                                category: { name: "เครื่องเขียน" },
                            },
                            variant: {
                                id: 11,
                                unit: "ด้าม",
                                attributeValues: [
                                    {
                                        attributeValue: {
                                            value: "แดง",
                                            attribute: { name: "สี" },
                                        },
                                    },
                                ],
                            },
                        },
                        {
                            quantity: 5,
                            item: {
                                id: 2,
                                name: "กระดาษ",
                                unit: "แผ่น",
                                category: { name: "เครื่องเขียน" },
                            },
                            variant: null,
                        },
                    ],
                },
            ]),
        );

        const response = await createStockRequestReportXlsxResponse(2031);
        const workbook = await loadWorkbook(response);
        const summarySheet = workbook.getWorksheet("สรุปการใช้วัสดุ");
        const detailSheet = workbook.getWorksheet("รายละเอียดที่ใช้คำนวณ");
        const penSummaryRow = findRowByCellValue(summarySheet, 2, "ปากกา");
        const paperSummaryRow = findRowByCellValue(summarySheet, 2, "กระดาษ");
        const workbookText = collectWorkbookText(workbook);

        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
            "สรุปการใช้วัสดุ",
            "รายละเอียดที่ใช้คำนวณ",
        ]);
        expect(prismaMock.stockRequestItem.count).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    request: {
                        status: "ISSUED",
                        issuedAt: {
                            gte: new Date("2030-12-31T17:00:00.000Z"),
                            lt: new Date("2031-12-31T17:00:00.000Z"),
                        },
                    },
                },
            }),
        );
        expect(summarySheet?.rowCount).toBe(3);
        expect(penSummaryRow?.getCell(3).value).toBe("สี: แดง");
        expect(penSummaryRow?.getCell(5).value).toBe(2);
        expect(penSummaryRow?.getCell(6).value).toBe(5);
        expect(penSummaryRow?.getCell(7).value).toBe(2);
        expect(penSummaryRow?.getCell(8).value).toEqual(
            bangkokExcelDate("2031-02-20T01:02:03.000Z"),
        );
        expect(paperSummaryRow?.getCell(3).value).toBe("-");
        expect(paperSummaryRow?.getCell(6).value).toBe(5);
        expect(summarySheet?.getRow(1).values).not.toContain("ผู้ขอไม่ซ้ำ");
        expect(summarySheet?.getRow(1).values).not.toContain("เดือนที่ใช้มากสุด");
        expect(detailSheet?.rowCount).toBe(3);
        expect(detailSheet?.getCell("B2").value).toEqual(
            bangkokExcelDate("2031-02-20T01:02:03.000Z"),
        );
        expect(detailSheet?.getCell("H2").value).toBe("ปากกา (สี: แดง) x3 ด้าม");
        expect(detailSheet?.getCell("I2").value).toBe(1);
        expect(detailSheet?.getCell("J2").value).toBe(3);
        expect(detailSheet?.getCell("H3").value).toBe(
            "ปากกา (สี: แดง) x2 ด้าม | กระดาษ (-) x5 แผ่น",
        );
        expect(detailSheet?.getCell("I3").value).toBe(2);
        expect(detailSheet?.getCell("J3").value).toBe(7);
        expect(workbookText).not.toContain("SKU");
        expect(workbookText).not.toContain("[");
    });

    it("should export stock balance xlsx with only actual balance sheet", async () => {
        prismaMock.stockItem.count.mockResolvedValue(asNever(1));
        prismaMock.stockItem.findMany.mockResolvedValue(
            asNever([
                {
                    id: 1,
                    name: "เมาส์",
                    description: "เมาส์ไร้สาย",
                    sku: "MOUSE-001",
                    unit: "ชิ้น",
                    quantity: 0,
                    minStock: 0,
                    imageUrl: null,
                    isActive: true,
                    categoryId: 10,
                    category: { name: "อุปกรณ์ไอที" },
                    variants: [
                        {
                            id: 11,
                            stockItemId: 1,
                            sku: "MOUSE-001-BLK",
                            unit: "ชิ้น",
                            quantity: 4,
                            minStock: 2,
                            imageUrl: null,
                            isActive: true,
                            attributeValues: [
                                {
                                    attributeValue: {
                                        value: "ดำ",
                                        attribute: { name: "สี" },
                                    },
                                },
                            ],
                        },
                        {
                            id: 12,
                            stockItemId: 1,
                            sku: "MOUSE-001-WHT",
                            unit: "ชิ้น",
                            quantity: 2,
                            minStock: 1,
                            imageUrl: null,
                            isActive: true,
                            attributeValues: [
                                {
                                    attributeValue: {
                                        value: "ขาว",
                                        attribute: { name: "สี" },
                                    },
                                },
                            ],
                        },
                    ],
                },
            ]),
        );
        prismaMock.stockRequestItem.findMany.mockResolvedValue(
            asNever([
                { itemId: 1, variantId: 11, quantity: 3 },
            ]),
        );

        const response = await createStockBalanceReportXlsxResponse();
        const workbook = await loadWorkbook(response);
        const balanceSheet = workbook.getWorksheet("ยอดคงเหลือจริง");
        const redVariantRow = findRowByCellValue(balanceSheet, 3, "สี: ดำ");
        const whiteVariantRow = findRowByCellValue(balanceSheet, 3, "สี: ขาว");
        const workbookText = collectWorkbookText(workbook);

        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
            "ยอดคงเหลือจริง",
        ]);
        expect(balanceSheet?.rowCount).toBe(3);
        expect(balanceSheet?.getRow(1).values).toEqual([
            undefined,
            "หมวดหมู่",
            "ชื่อวัสดุ",
            "รายการย่อย",
            "หน่วย",
            "คงเหลือจริง",
            "จองรอจ่าย",
            "พร้อมใช้",
            "จุดสั่งซื้อ",
            "สถานะสต๊อก",
        ]);
        expect(redVariantRow?.getCell(5).value).toBe(4);
        expect(redVariantRow?.getCell(6).value).toBe(3);
        expect(redVariantRow?.getCell(7).value).toBe(1);
        expect(redVariantRow?.getCell(8).value).toBe(2);
        expect(redVariantRow?.getCell(9).value).toBe("ต่ำกว่าจุดสั่งซื้อ");
        expect(whiteVariantRow?.getCell(5).value).toBe(2);
        expect(whiteVariantRow?.getCell(7).value).toBe(2);
        expect(workbookText).not.toContain("คำอธิบาย");
        expect(workbookText).not.toContain("ภาพรวมวัสดุ");
        expect(workbookText).not.toContain("SKU");
        expect(workbookText).not.toContain("[");
    });
});
