import { describe, expect, it } from "vitest";
import { formatAuditLogDisplay } from "@/lib/audit-log/display";

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
});
