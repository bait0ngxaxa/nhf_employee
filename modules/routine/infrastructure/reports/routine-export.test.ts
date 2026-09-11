import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import type { SerializedRoutineTaskWorkItem } from "../../application/queries";

const mocks = vi.hoisted(() => ({
    getRoutineTaskWorkItems: vi.fn(),
}));

vi.mock("../../application/queries", () => ({
    getRoutineTaskWorkItems: mocks.getRoutineTaskWorkItems,
}));

import { prepareRoutineTaskExport } from "./routine-export";

function task(
    id: number,
    title: string,
    ownerId: number,
): SerializedRoutineTaskWorkItem {
    return {
        canEdit: false,
        canDelete: false,
        id,
        title,
        description: "รายละเอียดงาน",
        scheduleType: "MONTHLY_DAY",
        scheduleConfig: { day: 10, monthOffset: 0 },
        scheduleText: "ทุกเดือน",
        contractStartDate: "2026-01-01",
        contractEndDate: "2026-12-31",
        contractText: "สัญญารายปี",
        extraDetails: "รายละเอียดเพิ่มเติม",
        businessDayPolicy: "NONE",
        isActive: true,
        unit: { id: 1, code: "มสช.", name: "มูลนิธิ" },
        category: { id: 1, name: "ระบบคอมพิวเตอร์" },
        assignees: [{
            employeeId: ownerId,
            role: "OWNER",
            employee: {
                id: ownerId,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                status: "ACTIVE",
                deletedAt: null,
                displayName: `พนักงาน ${ownerId}`,
            },
        }],
        reminderRules: [],
        relevantOccurrence: {
            id: id + 100,
            taskId: id,
            periodKey: "2026-08",
            dueDate: "2026-08-10",
            originalDueDate: "2026-08-10",
            scheduleVersion: 1,
            reminderVersion: 1,
            timingStatus: "UPCOMING",
            isOverdue: false,
            daysUntilDue: 2,
            assignees: [],
        },
    };
}

const queryActor = {
    actor: { id: 5, role: "USER", email: "user@example.com" },
    employeeId: 21,
};

describe("Routine task Excel export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates one row per all-scope task with Thai business headers", async () => {
        const tasks = [
            task(71, "งานของผู้ใช้อื่น", 42),
            task(72, "งานที่เกี่ยวข้อง", 21),
        ];
        mocks.getRoutineTaskWorkItems.mockResolvedValue({
            tasks,
            pagination: { page: 1, limit: 100, total: 2, pages: 1 },
        });

        const preparation = await prepareRoutineTaskExport(queryActor);

        expect(preparation.status).toBe("ready");
        expect(mocks.getRoutineTaskWorkItems).toHaveBeenCalledWith(
            { scope: "all", page: 1, limit: 100 },
            queryActor,
            { authorizationMode: "DEFERRED_EXPORT" },
        );
        if (preparation.status !== "ready") return;

        expect(preparation.response.headers.get("Content-Type")).toBe(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        expect(preparation.response.headers.get("Content-Disposition")).toContain(
            "filename*=UTF-8''",
        );

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await preparation.response.arrayBuffer());
        const sheet = workbook.getWorksheet("รายการงานประจำ");
        expect(sheet).toBeDefined();
        if (!sheet) return;

        expect(sheet.rowCount).toBe(3);
        expect(sheet.getRow(1).values).toEqual([
            undefined,
            "รหัสงาน",
            "ชื่องาน",
            "รายละเอียด",
            "หน่วยงาน",
            "หมวดหมู่",
            "รูปแบบกำหนดการ",
            "รายละเอียดกำหนดการ",
            "รอบงานที่เกี่ยวข้อง",
            "วันที่กำหนด",
            "สถานะเวลา",
            "ผู้รับผิดชอบหลัก",
            "ผู้รับผิดชอบร่วม",
            "วันเริ่มสัญญา",
            "วันสิ้นสุดสัญญา",
            "รายละเอียดสัญญา",
            "รายละเอียดเพิ่มเติม",
            "สถานะการใช้งาน",
        ]);
        expect(sheet.getRow(2).getCell(1).value).toBe(71);
        expect(sheet.getRow(2).getCell(2).value).toBe("งานของผู้ใช้อื่น");
        expect(sheet.getRow(2).getCell(11).value).toBe("พนักงาน 42");
        const rowText = Array.from(
            { length: sheet.columnCount },
            (_value, index: number) => String(
                sheet.getRow(2).getCell(index + 1).value ?? "",
            ),
        ).join(" ");
        expect(rowText).not.toContain("sourceFileName");
    });

    it("enforces the server-side task row limit", async () => {
        mocks.getRoutineTaskWorkItems.mockResolvedValue({
            tasks: [],
            pagination: {
                page: 1,
                limit: 100,
                total: EXPORT_LIMITS.routine.maxRows + 1,
                pages: EXPORT_LIMITS.routine.maxRows + 1,
            },
        });

        await expect(prepareRoutineTaskExport(queryActor)).resolves.toEqual({
            status: "limit-exceeded",
            recordCount: EXPORT_LIMITS.routine.maxRows + 1,
            maxRows: EXPORT_LIMITS.routine.maxRows,
        });
        expect(mocks.getRoutineTaskWorkItems).toHaveBeenCalledTimes(1);
    });
});
