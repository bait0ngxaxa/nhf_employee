import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { createStockBalanceReportCsvResponse } from "@/lib/services/stock/balance-export";
import { createStockRequestReportCsvResponse } from "@/lib/services/stock/report-export";
import { ensureItemVariantsExist } from "@/lib/services/stock/shared";
import type * as StockSharedModule from "@/lib/services/stock/shared";

vi.mock("@/lib/prisma", () => ({
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

describe("Stock report export services", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.mocked(ensureItemVariantsExist).mockReset();
    });

    it("should export stock request csv without SKU in item summaries", async () => {
        prismaMock.stockRequest.count.mockResolvedValue(asNever(1));
        prismaMock.stockRequest.findMany.mockResolvedValue(
            asNever([
                {
                    id: 99,
                    createdAt: new Date("2031-02-03T01:02:03.000Z"),
                    projectCode: "PRJ-2031",
                    status: "ISSUED",
                    issuedAt: new Date("2031-02-04T01:02:03.000Z"),
                    cancelReason: null,
                    cancelledAt: null,
                    requester: { name: "สมชาย", email: "somchai@test.com" },
                    issuer: { name: "ผู้จ่าย" },
                    canceller: null,
                    items: [
                        {
                            quantity: 2,
                            item: { name: "ปากกา", unit: "ด้าม" },
                            variant: {
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
                            item: { name: "กระดาษ", unit: "แผ่น" },
                            variant: null,
                        },
                    ],
                },
            ]),
        );

        const response = await createStockRequestReportCsvResponse(2031);
        const csv = await response.text();

        expect(csv).toContain("รายการวัสดุ");
        expect(csv).toContain("ปากกา (สี: แดง) x2 ด้าม | กระดาษ x5 แผ่น");
        expect(csv).not.toContain("SKU");
        expect(csv).not.toContain("[");
    });

    it("should export stock balance csv without SKU columns or variant SKU details", async () => {
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
                            minStock: 1,
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
                { itemId: 1, variantId: 11, quantity: 1 },
            ]),
        );

        const response = await createStockBalanceReportCsvResponse();
        const csv = await response.text();

        expect(csv).toContain("หมวดหมู่,ชื่อวัสดุ,คำอธิบาย");
        expect(csv).toContain("อุปกรณ์ไอที,เมาส์,เมาส์ไร้สาย,6,1,5,2,ชิ้น,ปกติ");
        expect(csv).toContain("สี: ดำ คงเหลือ 4 ชิ้น พร้อมใช้ 3 | สี: ขาว คงเหลือ 2 ชิ้น พร้อมใช้ 2");
        expect(csv).not.toContain("SKU");
        expect(csv).not.toContain("[");
    });
});
