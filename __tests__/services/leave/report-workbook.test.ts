import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { createLeaveReportWorkbook } from "@/lib/services/leave/report-workbook";
import type { LeaveReportEmployee } from "@/lib/services/leave/report-types";

describe("leave report workbook", () => {
    it("creates a valid two-sheet xlsx workbook by default", async () => {
        const workbook = createLeaveReportWorkbook([createEmployee()]);
        const buffer = await workbook.xlsx.writeBuffer();
        const loaded = new ExcelJS.Workbook();

        await loaded.xlsx.load(buffer);

        expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual([
            "สรุปรายคน",
            "รายละเอียดคำขอลา",
        ]);
        const summarySheet = loaded.getWorksheet("สรุปรายคน");
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
        expect(cellValues).not.toContain("ลาป่วยโควต้า");
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
