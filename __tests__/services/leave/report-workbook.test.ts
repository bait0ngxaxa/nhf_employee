import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { createLeaveReportWorkbook } from "@/lib/services/leave/report-workbook";
import type { LeaveReportEmployee } from "@/lib/services/leave/report-types";

describe("leave report workbook", () => {
    it("creates a valid two-sheet xlsx workbook", async () => {
        const workbook = createLeaveReportWorkbook([createEmployee()]);
        const buffer = await workbook.xlsx.writeBuffer();
        const loaded = new ExcelJS.Workbook();

        await loaded.xlsx.load(buffer);

        expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual([
            "สรุปรายคน",
            "รายละเอียดคำขอลา",
        ]);
        expect(loaded.getWorksheet("สรุปรายคน")?.getCell("A2").value).toBe("สมหญิง รักงาน");
        expect(loaded.getWorksheet("สรุปรายคน")?.getCell("M2").value).toBe(1);
        expect(loaded.getWorksheet("รายละเอียดคำขอลา")?.getCell("K2").value).toBe(1);
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
