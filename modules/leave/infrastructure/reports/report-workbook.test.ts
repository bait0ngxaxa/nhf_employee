import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { createLeaveReportWorkbook } from "./report-workbook";
import type { LeaveReportEmployee } from "./report-types";

describe("leave report workbook", () => {
    it("creates a valid two-sheet xlsx workbook by default", async () => {
        const workbook = createLeaveReportWorkbook([createEmployee()]);
        const buffer = await workbook.xlsx.writeBuffer();
        const loaded = new ExcelJS.Workbook();

        await loaded.xlsx.load(buffer);

        for (const [index, sheet] of loaded.worksheets.entries()) {
            expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1, xSplit: index === 0 ? 3 : 5 });
            expect(sheet.autoFilter).toBe(index === 0 ? "A1:U1" : "A1:R1");
            expect(sheet.getRow(1).height).toBe(30);
            sheet.getRow(1).eachCell((cell) => {
                expect(cell.font).toMatchObject({ name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } });
                expect(cell.fill).toMatchObject({ fgColor: { argb: "FF1F2937" } });
                expect(cell.border.bottom).toMatchObject({ style: "thin", color: { argb: "FF64748B" } });
            });
        }
        expect(loaded.worksheets[0].getCell("A3").fill).toMatchObject({ fgColor: { argb: "FFE0F2FE" } });
        expect(loaded.worksheets[1].getCell("F2").type).toBe(ExcelJS.ValueType.Date);
        expect(loaded.worksheets[1].getCell("F2").numFmt).toBe("dd/mm/yyyy");
        expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual([
            "สรุปรายคน",
            "รายละเอียดคำขอลา",
        ]);
        const summarySheet = loaded.getWorksheet("สรุปรายคน");
        expect(summarySheet?.getCell("D1").value).toBe("ลาป่วยสิทธิรวม");
        expect(summarySheet?.getCell("G1").value).toBe("ลากิจสิทธิรวม");
        expect(summarySheet?.getCell("J1").value).toBe("พักร้อนสิทธิรวม");
        expect(summarySheet?.getCell("A2").value).toBe("สมหญิง รักงาน");
        expect(summarySheet?.getCell("D2").value).toBe(30);
        expect(summarySheet?.getCell("E2").value).toBe(1);
        expect(summarySheet?.getCell("F2").value).toBe(29);
        expect(summarySheet?.getCell("M2").value).toBe(1);
        expect(summarySheet?.getCell("N2").value).toBe(45);
        expect(loaded.getWorksheet("รายละเอียดคำขอลา")?.getCell("K2").value).toBe(1);
        expect(loaded.getWorksheet("รายละเอียดคำขอลา")?.getCell("N1").value).toBe(
            "เหตุผลในการลาย้อนหลัง",
        );
    });

    it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)", "https://example.com", "ภาษาไทย\nบรรทัดใหม่"])("preserves literal free text %s and half days", async (text) => {
        const employee = createEmployee();
        employee.leaveRequests[0].reason = text;
        employee.leaveRequests[0].durationDays = 0.5;
        const loaded = new ExcelJS.Workbook();
        await loaded.xlsx.load(await createLeaveReportWorkbook([employee]).xlsx.writeBuffer());
        const cell = loaded.worksheets[1].getCell("M2");
        expect(cell.value).toBe(text);
        expect(cell.type).toBe(ExcelJS.ValueType.String);
        expect(loaded.worksheets[1].getCell("J2").value).toBe(0.5);
        expect(loaded.worksheets[1].getCell("J2").numFmt).toBe("0.#");
    });

    it("creates a detail-only workbook without quota summary headers", async () => {
        const workbook = createLeaveReportWorkbook([createEmployee()], {
            includeSummarySheet: false,
        });
        const buffer = await workbook.xlsx.writeBuffer();
        const loaded = new ExcelJS.Workbook();

        await loaded.xlsx.load(buffer);

        expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual([
            "รายละเอียดคำขอลา",
        ]);
        expect(loaded.getWorksheet("สรุปรายคน")).toBeUndefined();

        const detailSheet = loaded.getWorksheet("รายละเอียดคำขอลา");
        const cellValues: unknown[] = [];
        detailSheet?.eachRow((row) => {
            row.eachCell((cell) => cellValues.push(cell.value));
        });

        expect(detailSheet?.getCell("B1").value).toBe("ชื่อ-นามสกุล");
        expect(detailSheet?.getCell("E1").value).toBe("ประเภทการลา");
        expect(detailSheet?.getCell("F1").value).toBe("วันที่เริ่ม");
        expect(detailSheet?.getCell("G1").value).toBe("วันที่สิ้นสุด");
        expect(detailSheet?.getCell("I1").value).toBe("สถานะ");
        expect(detailSheet?.getCell("J1").value).toBe("จำนวนวันตามคำขอ");
        expect(detailSheet?.getCell("K1").value).toBe("วันลาสุทธิที่นับใช้");
        expect(cellValues).not.toContain("ลาป่วยสิทธิรวม");
        expect(cellValues).not.toContain("ลาป่วยคงเหลือ");
        expect(cellValues).not.toContain("รวมคงเหลือ");
        expect(cellValues).not.toContain("รวมทั้งทีม");
    });
});

function createEmployee(): LeaveReportEmployee {
    return {
        id: 1,
        firstName: "สมหญิง",
        lastName: "รักงาน",
        nickname: null,
        position: "ผู้ประสานงาน",
        dept: { name: "โครงการ" },
        leaveQuotas: [],
        leaveRequests: [
            {
                id: "leave-1",
                leaveType: "SICK",
                startDate: new Date("2031-02-03T00:00:00.000Z"),
                endDate: new Date("2031-02-03T00:00:00.000Z"),
                period: "FULL_DAY",
                durationDays: 1,
                reason: "ป่วย",
                emergencyReason: null,
                specialReason: null,
                overQuotaDays: 0,
                status: "APPROVED",
                rejectReason: null,
                notTakenReason: null,
                createdAt: new Date("2031-02-01T00:00:00.000Z"),
            },
        ],
    };
}
