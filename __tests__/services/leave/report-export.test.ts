import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    createLeaveReportXlsxResponse,
    getApproverHistoryReportMeta,
    getCurrentTeamReportMeta,
    loadApproverHistoryReportEmployees,
    loadCurrentTeamReportEmployees,
} from "@/lib/services/leave/report-export";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        employee: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        leaveRequest: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

describe("leave report export queries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.employee.count).mockResolvedValue(0);
        vi.mocked(prisma.employee.findMany).mockResolvedValue([]);
        vi.mocked(prisma.leaveRequest.count).mockResolvedValue(0);
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
    });

    it("counts approver history from approverId and does not filter current employee state", async () => {
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce([
            { employeeId: 301 },
            { employeeId: 302 },
        ] as never);
        vi.mocked(prisma.leaveRequest.count).mockResolvedValue(2);

        const meta = await getApproverHistoryReportMeta(101, 2031);

        expect(meta).toEqual({
            year: 2031,
            scope: "approver-history",
            employeeCount: 2,
            requestCount: 2,
            maxRows: 3000,
        });
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[0][0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({ approverId: 101 }),
                distinct: ["employeeId"],
            }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[0][0]?.where).not.toHaveProperty(
            "employee",
        );
        expect(vi.mocked(prisma.leaveRequest.count)).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ approverId: 101 }),
            }),
        );
    });

    it("keeps an inactive and soft-deleted employee in approver history after a manager change", async () => {
        const historicalRequest = createHistoricalRequest(101, 301);
        vi.mocked(prisma.leaveRequest.findMany)
            .mockResolvedValueOnce([historicalRequest] as never)
            .mockResolvedValueOnce([]);

        const oldApproverEmployees = await loadApproverHistoryReportEmployees(101, 2031);
        const newApproverEmployees = await loadApproverHistoryReportEmployees(102, 2031);

        expect(oldApproverEmployees).toHaveLength(1);
        expect(oldApproverEmployees[0]?.id).toBe(301);
        expect(oldApproverEmployees[0]?.leaveRequests).toHaveLength(1);
        expect(newApproverEmployees).toEqual([]);
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[0][0]?.where).toEqual(
            expect.objectContaining({ approverId: 101 }),
        );
        expect(vi.mocked(prisma.leaveRequest.findMany).mock.calls[1][0]?.where).toEqual(
            expect.objectContaining({ approverId: 102 }),
        );
    });

    it("uses current manager and active employee filters only for current team reports", async () => {
        await getCurrentTeamReportMeta(102, 2031);

        expect(prisma.employee.count).toHaveBeenCalledWith({
            where: {
                managerId: 102,
                status: "ACTIVE",
                deletedAt: null,
            },
        });
        expect(prisma.leaveRequest.count).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    employee: {
                        managerId: 102,
                        status: "ACTIVE",
                        deletedAt: null,
                    },
                }),
            }),
        );
    });

    it("lets current-team reports include an employee after moving under the new manager", async () => {
        const historicalRequest = createHistoricalRequest(101, 301);
        const { employee: employeeProfile, ...request } = historicalRequest;
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            {
                ...employeeProfile,
                leaveRequests: [request],
            },
        ] as never);

        const employees = await loadCurrentTeamReportEmployees(102, 2031);

        expect(employees.map((employee) => employee.id)).toEqual([301]);
        expect(prisma.employee.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    managerId: 102,
                    status: "ACTIVE",
                    deletedAt: null,
                },
            }),
        );
    });

    it("derives report entitlement across a missing quota year", async () => {
        const historicalRequest = createHistoricalRequest(101, 301);
        const { employee: employeeProfile, ...request } = historicalRequest;
        vi.mocked(prisma.employee.findMany).mockResolvedValue([{
            ...employeeProfile,
            leaveQuotas: [{
                leaveType: "PERSONAL",
                year: 2029,
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 12,
            }],
            leaveRequests: [request],
        }] as never);

        const employees = await loadCurrentTeamReportEmployees(101, 2031);

        expect(employees[0]?.leaveQuotas).toContainEqual({
            leaveType: "PERSONAL",
            effectiveTotalDays: 24,
        });
    });

    it("keeps negative effective entitlement in report quota data", async () => {
        const historicalRequest = createHistoricalRequest(101, 301);
        const { employee: employeeProfile, ...request } = historicalRequest;
        vi.mocked(prisma.employee.findMany).mockResolvedValue([{
            ...employeeProfile,
            leaveQuotas: [{
                leaveType: "PERSONAL",
                year: 2031,
                totalHalfDays: 20,
                carryBalanceHalfDays: -24,
                usedHalfDays: 0,
            }],
            leaveRequests: [request],
        }] as never);

        const employees = await loadCurrentTeamReportEmployees(101, 2031);

        expect(employees[0]?.leaveQuotas).toContainEqual({
            leaveType: "PERSONAL",
            effectiveTotalDays: -2,
        });
    });

    it("exports current-team reports with summary and detail sheets", async () => {
        const historicalRequest = createHistoricalRequest(101, 301);
        const { employee: employeeProfile, ...request } = historicalRequest;
        vi.mocked(prisma.employee.findMany).mockResolvedValue([
            {
                ...employeeProfile,
                leaveRequests: [request],
            },
        ] as never);

        const response = await createLeaveReportXlsxResponse(101, 2031, "current-team");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await response.arrayBuffer());

        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
            "สรุปรายคน",
            "รายละเอียดคำขอลา",
        ]);
        expect(workbook.getWorksheet("สรุปรายคน")?.getCell("D2").value).toBe(30);
        expect(workbook.getWorksheet("สรุปรายคน")?.getCell("E2").value).toBe(1);
        expect(workbook.getWorksheet("สรุปรายคน")?.getCell("F2").value).toBe(29);
        expect(getDecodedFilename(response)).toContain("รายงานสรุปการลา_ปี-2031");
    });

    it("exports approver-history as detail-only and uses a history filename", async () => {
        const firstRequest = createHistoricalRequest(101, 301, "leave-1");
        const secondRequest = createHistoricalRequest(101, 301, "leave-2");
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([
            firstRequest,
            secondRequest,
        ] as never);

        const employees = await loadApproverHistoryReportEmployees(101, 2031);
        const meta = {
            employeeCount: employees.length,
            requestCount: employees.reduce((count, employee) => count + employee.leaveRequests.length, 0),
        };
        const response = await createLeaveReportXlsxResponse(101, 2031, "approver-history");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await response.arrayBuffer());

        expect(meta).toEqual({ employeeCount: 1, requestCount: 2 });
        expect(workbook.getWorksheet("สรุปรายคน")).toBeUndefined();
        expect(workbook.getWorksheet("รายละเอียดคำขอลา")?.rowCount).toBe(meta.requestCount + 1);
        expect(workbook.getWorksheet("รายละเอียดคำขอลา")?.getCell("B1").value).toBe(
            "ชื่อ-นามสกุล",
        );
        expect(workbook.getWorksheet("รายละเอียดคำขอลา")?.getCell("J1").value).toBe(
            "จำนวนวันตามคำขอ",
        );
        expect(getDecodedFilename(response)).toContain("ประวัติการอนุมัติการลา_ปี-2031");
    });
});

function getDecodedFilename(response: Response): string {
    const contentDisposition = response.headers.get("Content-Disposition");
    const encodedFilename = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
    return encodedFilename ? decodeURIComponent(encodedFilename) : "";
}

function createHistoricalRequest(
    approverId: number,
    employeeId: number,
    id = "leave-1",
) {
    return {
        id,
        employeeId,
        leaveType: "SICK",
        startDate: new Date("2031-02-03T00:00:00.000Z"),
        endDate: new Date("2031-02-03T00:00:00.000Z"),
        period: "FULL_DAY",
        durationHalfDays: 2,
        reason: "เหตุผลการลา",
        emergencyReason: null,
        specialReason: null,
        overQuotaHalfDays: 0,
        status: "APPROVED",
        rejectReason: null,
        notTakenReason: null,
        createdAt: new Date("2031-02-01T00:00:00.000Z"),
        approverId,
        employee: {
            id: employeeId,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            position: "เจ้าหน้าที่",
            dept: { name: "งานบุคคล" },
            leaveQuotas: [],
        },
    };
}
