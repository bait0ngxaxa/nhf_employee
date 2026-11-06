import ExcelJS from "exceljs";
import type { PrismaClient } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { createEmployeeExport } from "./employee-export";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

afterEach(() => {
    vi.useRealTimers();
});

describe("Employee XLSX export", () => {
    beforeEach(() => mockReset(prismaMock));

    it.each([0, 1, 251, 2000])("exports all %i records regardless of UI pagination", async (count) => {
        const employees = Array.from({ length: count }, (_, index) => ({
            firstName: `พนักงาน ${index}`, lastName: "ทดสอบ", nickname: "นิด",
            position: "เจ้าหน้าที่", affiliation: "NHF", email: "staff@example.com",
            phone: "0812345678", hireDate: null, status: "ACTIVE",
            dept: { name: "บริหาร" },
        }));
        prismaMock.employee.count.mockResolvedValue(count);
        for (let offset = 0; offset < count; offset += 250) {
            prismaMock.employee.findMany.mockResolvedValueOnce(employees.slice(offset, offset + 250) as never);
        }

        const result = await createEmployeeExport({ page: 9, limit: 10, search: "พนักงาน", status: "ACTIVE" });
        expect(result.status).toBe("ready");
        if (result.status !== "ready") throw new Error("Expected ready export");
        expect(result.recordCount).toBe(count);
        expect(result.auditFilters).toEqual({ search: "พนักงาน", status: "ACTIVE" });
        expect(result.response.headers.get("Content-Type")).toBe(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        const disposition = result.response.headers.get("Content-Disposition") ?? "";
        expect(disposition).toContain('attachment; filename="export.xlsx"; filename*=UTF-8\'\'');
        expect(decodeURIComponent(disposition)).toMatch(/รายชื่อพนักงาน_ค้นหา-พนักงาน_สถานะ-ทำงานอยู่.*\.xlsx$/);
        expect(result.response.headers.get("Cache-Control")).toBe("no-store");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await result.response.arrayBuffer());
        const sheet = workbook.worksheets[0];
        expect(sheet.name).toBe("รายชื่อพนักงาน");
        expect(sheet.rowCount).toBe(count + 1);
        expect(sheet.columnCount).toBe(12);
        expect(sheet.autoFilter).toBe("A1:L1");
        expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
        expect(sheet.getRow(1).height).toBe(30);
        for (let column = 1; column <= 12; column++) {
            const cell = sheet.getCell(1, column);
            expect(cell.font).toMatchObject({ name: "Arial", bold: true, color: { argb: "FFFFFFFF" } });
            expect(cell.fill).toMatchObject({ fgColor: { argb: "FF1F2937" } });
            expect(cell.alignment.vertical).toBe("middle");
            expect(cell.border.right?.style).toBe("thin");
            expect(sheet.getColumn(column).width).toBeGreaterThanOrEqual(10);
        }
        for (let index = 0; index < count; index++) {
            expect(sheet.getRow(index + 2).values).toEqual([
                undefined, index + 1, `พนักงาน ${index}`, "ทดสอบ", "นิด", "เจ้าหน้าที่",
                "NHF", "บริหาร", "staff@example.com", "0812345678", "ทำงานอยู่", "ไม่ระบุ", "ยังไม่ทราบ",
            ]);
            expect(sheet.getCell(index + 2, 9).numFmt).toBe("@");
        }
        const where = prismaMock.employee.count.mock.calls[0]?.[0]?.where;
        expect(where).toMatchObject({
            deletedAt: null, status: "ACTIVE", OR: expect.arrayContaining([
                { firstName: { contains: "พนักงาน" } },
                { dept: { name: { contains: "พนักงาน" } } },
            ]),
        });
        expect(prismaMock.employee.findMany).toHaveBeenCalledTimes(Math.ceil(count / 250));
        for (let batch = 0; batch < Math.ceil(count / 250); batch++) {
            expect(prismaMock.employee.findMany).toHaveBeenNthCalledWith(batch + 1, expect.objectContaining({
                where, skip: batch * 250, take: 250,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            }));
        }
    });

    it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)", 'ไทย & < > " ,\nบรรทัดใหม่ 😊', "https://example.com"])(
        "preserves untrusted text literally: %s", async (text) => {
            prismaMock.employee.count.mockResolvedValue(1);
            prismaMock.employee.findMany.mockResolvedValue([{
                firstName: text, lastName: text, nickname: text, position: text,
                affiliation: text, email: text, phone: text, hireDate: null,
                status: "ACTIVE", dept: { name: text },
            }] as never);
            const result = await createEmployeeExport({ page: 1, limit: 10 });
            if (result.status !== "ready") throw new Error("Expected ready export");
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await result.response.arrayBuffer());
            for (let column = 2; column <= 9; column++) {
                const cell = workbook.worksheets[0].getCell(2, column);
                expect(cell.value).toBe(text);
                expect(cell.type).toBe(ExcelJS.ValueType.String);
                expect(cell.formula).toBeUndefined();
                expect(cell.hyperlink).toBeUndefined();
            }
        },
    );

    it("rejects more than 2000 matching rows", async () => {
        prismaMock.employee.count.mockResolvedValue(2001);
        await expect(createEmployeeExport({ page: 1, limit: 10 })).resolves.toEqual({
            status: "limit-exceeded",
            recordCount: 2001,
            maxRows: 2000,
        });
        expect(prismaMock.employee.findMany).not.toHaveBeenCalled();
    });

    it("exports Thai headings and renders temporary email and missing values as dash", async () => {
        prismaMock.employee.count.mockResolvedValue(1);
        prismaMock.employee.findMany
            .mockResolvedValueOnce([{
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                position: "เจ้าหน้าที่",
                affiliation: null,
                email: "no-email-1@temp.local",
                phone: null,
                hireDate: null,
                status: "ACTIVE",
                dept: null,
            }] as never);

        const result = await createEmployeeExport({ page: 1, limit: 10 });
        expect(result.status).toBe("ready");
        if (result.status !== "ready") return;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await result.response.arrayBuffer());
        const sheet = workbook.worksheets[0];

        expect(sheet.getRow(1).values).toEqual([
            undefined, "ลำดับ", "ชื่อ", "นามสกุล", "ชื่อเล่น", "ตำแหน่ง",
            "สังกัด", "แผนก", "อีเมล", "เบอร์โทร", "สถานะ", "วันที่เริ่มงาน", "อายุงาน",
        ]);
        expect(sheet.getRow(2).values).toEqual([
            undefined, 1, "สมชาย", "ใจดี", "-", "เจ้าหน้าที่", "-", "-",
            "-", "-", "ทำงานอยู่", "ไม่ระบุ", "ยังไม่ทราบ",
        ]);
        expect(prismaMock.employee.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            select: expect.objectContaining({ hireDate: true }),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: 0,
            take: 250,
        }));
    });

    it.each([
        ["2026-11-04T16:59:59.999Z", "3 ปี 7 เดือน 3 วัน"],
        ["2026-11-04T17:00:00.000Z", "3 ปี 7 เดือน 4 วัน"],
    ])("exports tenure on the Thailand calendar at %s", async (instant, tenure) => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(instant));
        prismaMock.employee.count.mockResolvedValue(1);
        prismaMock.employee.findMany.mockResolvedValueOnce([{
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            position: "เจ้าหน้าที่",
            affiliation: null,
            email: "somchai@thainhf.org",
            phone: null,
            hireDate: new Date("2023-04-01T00:00:00.000Z"),
            status: "ACTIVE",
            dept: { name: "บริหาร" },
        }] as never);

        const result = await createEmployeeExport({ page: 1, limit: 10 });
        expect(result.status).toBe("ready");
        if (result.status !== "ready") return;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await result.response.arrayBuffer());
        const sheet = workbook.worksheets[0];
        expect(sheet.getCell("K2").value).toBe("01/04/2566");
        expect(sheet.getCell("L2").value).toBe(tenure);
    });
});
