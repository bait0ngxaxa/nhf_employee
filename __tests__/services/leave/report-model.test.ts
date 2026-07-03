import { describe, expect, it } from "vitest";

import { buildLeaveReportRows } from "@/lib/services/leave/report-model";
import type { LeaveReportEmployee } from "@/lib/services/leave/report-types";

describe("leave report model", () => {
    it("summarizes current team employees and keeps detail rows reconciled", () => {
        const rows = buildLeaveReportRows([createEmployee()]);
        const [employeeSummary, teamSummary] = rows.summaryRows;

        expect(employeeSummary).toEqual(
            expect.objectContaining({
                employeeName: "สมชาย ใจดี (ชาย)",
                sickQuota: 30,
                sickUsed: 1,
                sickRemaining: 29,
                personalQuota: 8,
                personalUsed: 0,
                personalRemaining: 8,
                vacationQuota: 6,
                vacationUsed: 1.5,
                vacationRemaining: 4.5,
                totalUsed: 2.5,
                pendingDays: 0.5,
                approvedRequestCount: 2,
                pendingRequestCount: 1,
                inactiveRequestCount: 1,
                notTakenCount: 1,
                overQuotaDays: 1,
            }),
        );
        expect(teamSummary?.employeeName).toBe("รวมทั้งทีม");
        expect(teamSummary?.totalUsed).toBe(2.5);
        expect(rows.detailRows).toHaveLength(5);
        expect(rows.detailRows.map((row) => row.effectiveDays)).toEqual([1, 1.5, 0, 0, 0]);
    });
});

function createEmployee(): LeaveReportEmployee {
    return {
        id: 1,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: "ชาย",
        position: "เจ้าหน้าที่",
        dept: { name: "งานบุคคล" },
        leaveQuotas: [{ leaveType: "PERSONAL", totalDays: 8 }],
        leaveRequests: [
            createRequest("leave-1", "SICK", "APPROVED", 1, 0),
            createRequest("leave-2", "VACATION", "APPROVED", 1.5, 1),
            createRequest("leave-3", "PERSONAL", "PENDING", 0.5, 0),
            createRequest("leave-4", "SICK", "REJECTED", 1, 0),
            createRequest("leave-5", "VACATION", "NOT_TAKEN", 1, 0),
        ],
    };
}

function createRequest(
    id: string,
    leaveType: LeaveReportEmployee["leaveRequests"][number]["leaveType"],
    status: LeaveReportEmployee["leaveRequests"][number]["status"],
    durationDays: number,
    overQuotaDays: number,
): LeaveReportEmployee["leaveRequests"][number] {
    return {
        id,
        leaveType,
        startDate: new Date(`2031-01-0${id.at(-1)}T00:00:00.000Z`),
        endDate: new Date(`2031-01-0${id.at(-1)}T00:00:00.000Z`),
        period: durationDays === 0.5 ? "MORNING" : "FULL_DAY",
        durationDays,
        reason: "เหตุผลการลา",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays,
        status,
        rejectReason: status === "REJECTED" ? "ไม่อนุมัติ" : null,
        notTakenReason: status === "NOT_TAKEN" ? "ไม่ได้ใช้" : null,
        createdAt: new Date("2031-01-01T00:00:00.000Z"),
    };
}
