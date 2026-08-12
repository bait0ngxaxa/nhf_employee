import { describe, expect, it } from "vitest";
import { formatAuditLogDisplay } from "@/lib/audit-log/display";
import { buildCreatedLeaveRequestAuditDetails } from "@/lib/services/leave/create-request-audit";

describe("formatAuditLogDisplay", () => {
    it("summarizes legacy before and after values in Thai", () => {
        const result = formatAuditLogDisplay({
            action: "EMPLOYEE_UPDATE",
            entityType: "Employee",
            entityId: 12,
            details: {
                before: { position: "เจ้าหน้าที่", email: "old@thainhf.org" },
                after: { position: "หัวหน้างาน", email: "new@thainhf.org" },
            },
        });

        expect(result.entityReference).toBe("พนักงาน #12");
        expect(result.summary).toContain("ตำแหน่ง: เจ้าหน้าที่ → หัวหน้างาน");
        expect(result.summary).toContain("อีเมล: old@thainhf.org → new@thainhf.org");
    });

    it("formats leave request metadata as a readable Thai sentence", () => {
        const result = formatAuditLogDisplay({
            action: "LEAVE_REQUEST_CREATE",
            entityType: "LeaveRequest",
            entityId: null,
            details: {
                metadata: {
                    leaveType: "SICK",
                    period: "FULL_DAY",
                    startDate: "2026-07-10T00:00:00.000Z",
                    endDate: "2026-07-11T00:00:00.000Z",
                    durationDays: 2,
                },
            },
        });

        expect(result.summary).toContain("ลาป่วย");
        expect(result.summary).toContain("จำนวน 2 วัน");
        expect(result.summary).toContain("เต็มวัน");
    });

    it("does not expose sensitive keys in change summaries", () => {
        const result = formatAuditLogDisplay({
            action: "USER_UPDATE",
            entityType: "User",
            entityId: 7,
            details: {
                before: { name: "Admin", sessionToken: "old-token" },
                after: { name: "Admin 2", sessionToken: "new-token" },
            },
        });

        expect(result.summary).toContain("ชื่อ: Admin → Admin 2");
        expect(result.summary).not.toContain("token");
        expect(result.summary).not.toContain("new-token");
    });

    it("formats stock export entity types without technical English", () => {
        const balanceExport = formatAuditLogDisplay({
            action: "DATA_EXPORT",
            entityType: "StockItem",
            entityId: null,
            details: {
                metadata: {
                    recordCount: 25,
                    filters: { reportType: "balances", format: "xlsx" },
                },
            },
        });
        const requestExport = formatAuditLogDisplay({
            action: "DATA_EXPORT",
            entityType: "StockRequest",
            entityId: null,
            details: {
                metadata: {
                    recordCount: 12,
                    filters: { year: 2026, format: "xlsx" },
                },
            },
        });

        expect(balanceExport.entityReference).toBe("วัสดุ");
        expect(balanceExport.summary).toContain("รายงานยอดคงเหลือวัสดุ");
        expect(balanceExport.summary).not.toContain("StockItem");
        expect(balanceExport.summary).not.toContain("balances");
        expect(requestExport.entityReference).toBe("คำขอเบิกวัสดุ");
        expect(requestExport.summary).toContain("รายงานเบิกวัสดุ");
        expect(requestExport.summary).not.toContain("StockRequest");
    });

    it("formats stock adjustment enum values in Thai", () => {
        const result = formatAuditLogDisplay({
            action: "STOCK_ITEM_UPDATE",
            entityType: "Stock",
            entityId: 9,
            details: {
                before: { type: "OUT" },
                after: { type: "IN" },
            },
        });

        expect(result.summary).toContain("ประเภท: ลดสต็อก → เพิ่มสต็อก");
        expect(result.summary).not.toContain("OUT");
        expect(result.summary).not.toContain("IN");
    });

    it("formats detailed stock entity types and adjustment before/after values", () => {
        const adjustment = formatAuditLogDisplay({
            action: "STOCK_ADJUST",
            entityType: "StockAdjustment",
            entityId: 701,
            details: {
                before: { quantity: 12, minStock: 4 },
                after: { name: "หมึกพิมพ์", quantity: 15, minStock: 7 },
                metadata: { adjustmentQuantity: 3, adjustmentType: "IN" },
            },
        });
        const variant = formatAuditLogDisplay({
            action: "STOCK_ITEM_UPDATE",
            entityType: "StockVariant",
            entityId: 102,
            details: null,
        });

        expect(adjustment.entityReference).toBe("รายการปรับยอดสต็อก #701");
        expect(adjustment.summary).toContain("เพิ่ม 3 จาก 12 เป็น 15");
        expect(variant.entityReference).toBe("รายการย่อยวัสดุ #102");
    });

    it("formats a stock item update with only changed business fields", () => {
        const result = formatAuditLogDisplay({
            action: "STOCK_ITEM_UPDATE",
            entityType: "StockItem",
            entityId: 10,
            details: {
                before: {
                    name: "กระดาษ A4",
                    sku: "PAPER-A4",
                    unit: "รีม",
                    minStock: 5,
                    categoryId: 1,
                    categoryName: "เครื่องเขียน",
                },
                after: {
                    name: "กระดาษ A4",
                    sku: "PAPER-A4",
                    unit: "แพ็ค",
                    minStock: 10,
                    categoryId: 1,
                    categoryName: "เครื่องเขียน",
                },
            },
        });

        expect(result.summary).toContain("แก้ไขวัสดุ “กระดาษ A4” (SKU: PAPER-A4)");
        expect(result.summary).toContain("หน่วย: รีม → แพ็ค");
        expect(result.summary).toContain("จำนวนขั้นต่ำ: 5 → 10");
        expect(result.summary).not.toContain("categoryId");
        expect(result.summary).not.toContain("หมวดหมู่: 1");
        expect(result.summary).not.toContain("ชื่อ: กระดาษ A4 → กระดาษ A4");
    });

    it("formats stock variant attributes without meaningless placeholders", () => {
        const result = formatAuditLogDisplay({
            action: "STOCK_ITEM_UPDATE",
            entityType: "StockVariant",
            entityId: 21,
            details: {
                before: {
                    sku: "PAPER-A4-70",
                    unit: "รีม",
                    minStock: 5,
                    attributes: [{ name: "ความหนา", value: "70 แกรม" }],
                },
                after: {
                    sku: "PAPER-A4-80",
                    unit: "รีม",
                    minStock: 10,
                    attributes: [{ name: "ความหนา", value: "80 แกรม" }],
                },
                metadata: {
                    itemName: "กระดาษ A4",
                    itemSku: "PAPER-A4",
                    variantLabel: "80 แกรม",
                },
            },
        });

        expect(result.summary).toContain("แก้ไขรายการย่อย “กระดาษ A4 / 80 แกรม”");
        expect(result.summary).toContain("จำนวนขั้นต่ำ: 5 → 10");
        expect(result.summary).toContain("คุณลักษณะ: ความหนา: 70 แกรม → ความหนา: 80 แกรม");
        expect(result.summary).not.toContain("attributes");
        expect(result.summary).not.toContain("- → -");
    });

    it("formats stock request create, issue, and cancel context", () => {
        const baseMetadata = {
            stockRequestId: 152,
            projectCode: "ABC",
            lines: [
                {
                    itemId: 10,
                    itemName: "กระดาษ A4",
                    sku: "PAPER-A4",
                    variantId: 21,
                    variantLabel: "80 แกรม",
                    quantity: 2,
                    unit: "รีม",
                },
                {
                    itemId: 11,
                    itemName: "ปากกา",
                    sku: "PEN-BLUE",
                    variantId: 22,
                    quantity: 2,
                    unit: "ด้าม",
                },
            ],
        };
        const create = formatAuditLogDisplay({
            action: "STOCK_REQUEST_CREATE",
            entityType: "StockRequest",
            entityId: 152,
            details: { after: { itemCount: 2 }, metadata: baseMetadata },
        });
        const issue = formatAuditLogDisplay({
            action: "STOCK_REQUEST_ISSUE",
            entityType: "StockRequest",
            entityId: 152,
            details: { metadata: baseMetadata },
        });
        const cancel = formatAuditLogDisplay({
            action: "STOCK_REQUEST_CANCEL",
            entityType: "StockRequest",
            entityId: 152,
            details: { metadata: { ...baseMetadata, reason: "วัสดุไม่เพียงพอ" } },
        });

        expect(create.summary).toBe("สร้างคำขอเบิก #152 โครงการ ABC จำนวน 2 รายการ");
        expect(issue.summary).toBe("จ่ายคำขอเบิก #152 โครงการ ABC จำนวน 2 รายการ");
        expect(cancel.summary).toBe("ยกเลิกคำขอเบิก #152: วัสดุไม่เพียงพอ");
        expect(issue.summary).not.toContain("itemId");
        expect(issue.summary).not.toContain("variantId");
    });

    it("uses the real leave creation payload builder for the detailed summary", () => {
        const details = buildCreatedLeaveRequestAuditDetails({
            request: {
                id: "leave-1",
                employeeId: 9,
                leaveType: "SICK",
                startDate: new Date("2026-07-10T00:00:00.000Z"),
                endDate: new Date("2026-07-11T00:00:00.000Z"),
                period: "FULL_DAY",
                durationHalfDays: 4,
            },
            employeeName: "สมชาย ใจดี",
            attachmentCount: 1,
        });
        const result = formatAuditLogDisplay({
            action: "LEAVE_REQUEST_CREATE",
            entityType: "LeaveRequest",
            entityId: null,
            details,
        });

        expect(result.summary).toContain("ยื่นคำขอลาป่วยของ สมชาย ใจดี");
        expect(result.summary).toContain("จำนวน 2 วัน (เต็มวัน)");
        expect(details.metadata.attachmentCount).toBe(1);
    });

    it("formats leave approval and rejection with employee context and reason", () => {
        const metadata = {
            leaveRequestId: "leave-2",
            employeeName: "สมชาย ใจดี",
            leaveType: "SICK",
            startDate: "2026-07-10T00:00:00.000Z",
            endDate: "2026-07-11T00:00:00.000Z",
            period: "FULL_DAY",
            durationDays: 2,
        };
        const approved = formatAuditLogDisplay({
            action: "LEAVE_REQUEST_APPROVE",
            entityType: "LeaveRequest",
            entityId: null,
            details: { metadata },
        });
        const rejected = formatAuditLogDisplay({
            action: "LEAVE_REQUEST_REJECT",
            entityType: "LeaveRequest",
            entityId: null,
            details: { after: { reason: "เอกสารไม่ครบ" }, metadata },
        });

        expect(approved.summary).toContain("อนุมัติคำขอลาป่วยของ สมชาย ใจดี");
        expect(rejected.summary).toContain("ไม่อนุมัติคำขอลาป่วยของ สมชาย ใจดี");
        expect(rejected.summary).toContain(": เอกสารไม่ครบ");
    });

    it("formats leave approver reassignment with immutable names", () => {
        const result = formatAuditLogDisplay({
            action: "EMPLOYEE_UPDATE",
            entityType: "EmployeeApprover",
            entityId: 10,
            details: {
                before: { managerId: 20, managerName: "วิชัย ใจดี" },
                after: { managerId: 21, managerName: "สุชาติ ใจดี" },
                metadata: {
                    employeeName: "สมชาย ใจดี",
                    previousApproverName: "วิชัย ใจดี",
                    newApproverName: "สุชาติ ใจดี",
                },
            },
        });

        expect(result.summary).toBe(
            "เปลี่ยนผู้อนุมัติการลาของ สมชาย ใจดี: วิชัย ใจดี → สุชาติ ใจดี",
        );
        expect(result.summary).not.toContain("managerId");
    });

    it.each([
        ["ROUTINE_TASK_CREATE", "RoutineTask", { taskId: 1, title: "ตรวจอุปกรณ์" }, "สร้างแม่แบบงานประจำ “ตรวจอุปกรณ์”"],
        ["ROUTINE_TASK_DEACTIVATE", "RoutineTask", { before: { title: "ตรวจอุปกรณ์", isActive: true }, after: { title: "ตรวจอุปกรณ์", isActive: false } }, "ปิดใช้งานแม่แบบงานประจำ “ตรวจอุปกรณ์”"],
        ["ROUTINE_TASK_DELETE", "RoutineTask", { taskId: 1, title: "ตรวจอุปกรณ์" }, "ลบแม่แบบงานประจำ “ตรวจอุปกรณ์”"],
        ["ROUTINE_OCCURRENCE_REASSIGN", "RoutineOccurrence", { taskTitle: "ตรวจอุปกรณ์", previousEmployeeIds: [1], affectedEmployeeIds: [2, 3] }, "เปลี่ยนผู้รับผิดชอบรอบงาน “ตรวจอุปกรณ์”: 1 คน → 2 คน"],
        ["ROUTINE_OCCURRENCE_DUE_DATE_CHANGE", "RoutineOccurrence", { taskTitle: "ตรวจอุปกรณ์", oldDueDate: "2026-07-10", newDueDate: "2026-07-11" }, "เปลี่ยนวันกำหนดรอบงาน “ตรวจอุปกรณ์”"],
        ["ROUTINE_IMPORT_UPLOAD", "RoutineImportBatch", { fileName: "routine.xlsx", totalRows: 20 }, "อัปโหลดไฟล์งานประจำ “routine.xlsx” จำนวน 20 แถว"],
        ["ROUTINE_IMPORT_ROW_UPDATE", "RoutineImportRow", { sourceKey: "งานประจำ!12" }, "แก้ไขแถวนำเข้างานประจำ “งานประจำ!12”"],
        ["ROUTINE_IMPORT_APPLY", "RoutineImportBatch", { targetSheet: "งานประจำ", appliedRows: 18 }, "นำเข้างานประจำจาก “งานประจำ” สำเร็จ 18 รายการ"],
        ["ROUTINE_IMPORT_CANCEL", "RoutineImportBatch", { targetSheet: "งานประจำ" }, "ยกเลิกการนำเข้างานประจำ “งานประจำ”"],
    ])("formats %s as a readable Routine summary", (action, entityType, details, expected) => {
        const result = formatAuditLogDisplay({
            action,
            entityType,
            entityId: 1,
            details,
        });

        expect(result.summary).toContain(expected);
        expect(result.summary).not.toBe("การดำเนินการอื่น ๆ");
    });

    it("formats Routine task changes without exposing technical fields", () => {
        const result = formatAuditLogDisplay({
            action: "ROUTINE_TASK_UPDATE",
            entityType: "RoutineTask",
            entityId: 1,
            details: {
                before: { title: "ตรวจอุปกรณ์", scheduleType: "MONTHLY_DAY", version: 1 },
                after: { title: "ตรวจอุปกรณ์สำนักงาน", scheduleType: "MONTH_END", version: 2 },
            },
        });

        expect(result.summary).toContain("หัวข้อ: ตรวจอุปกรณ์ → ตรวจอุปกรณ์สำนักงาน");
        expect(result.summary).toContain("รอบการทำงาน: รายเดือน → สิ้นเดือน");
        expect(result.summary).not.toContain("version");
    });

    it("does not expose sensitive values nested in unsupported structures", () => {
        const result = formatAuditLogDisplay({
            action: "USER_UPDATE",
            entityType: "User",
            entityId: 7,
            details: {
                before: { profile: { theme: "light", sessionToken: "old" } },
                after: { profile: { theme: "dark", sessionToken: "new-secret" } },
            },
        });

        expect(result.summary).not.toContain("session");
        expect(result.summary).not.toContain("new-secret");
        expect(result.changedFields).toEqual([]);
    });
});
