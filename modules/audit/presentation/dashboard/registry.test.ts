import { AuditAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    AUDIT_ACTION_FILTER_OPTIONS,
    AUDIT_ACTION_META,
    AUDIT_ENTITY_LABELS,
    AUDIT_ENTITY_TYPE_OPTIONS,
    getAuditActionLabel,
} from "./registry";

describe("audit registry", () => {
    it("registers metadata and a filter option for every active AuditAction", () => {
        const inactiveLegacyActions = new Set<AuditAction>([
            AuditAction.TICKET_DELETE,
        ]);
        const activeActions = Object.values(AuditAction)
            .filter((action) => !inactiveLegacyActions.has(action))
            .sort();
        const registeredActions = Object.keys(AUDIT_ACTION_META).sort();
        const filterActions = AUDIT_ACTION_FILTER_OPTIONS
            .map(({ value }) => value)
            .filter((value) => value !== "all")
            .sort();

        expect(registeredActions).toEqual(activeActions);
        expect(filterActions).toEqual(activeActions);
    });

    it("registers business labels for emitted non-model entity types", () => {
        expect(AUDIT_ENTITY_LABELS).toMatchObject({
            StockVariant: "รายการย่อยวัสดุ",
            StockAdjustment: "รายการปรับยอดสต็อก",
            EmployeeApprover: "ผู้อนุมัติการลา",
            RoutineTask: "แม่แบบงานประจำ",
            RoutineOccurrence: "รอบงานประจำ",
            RoutineImportBatch: "ชุดนำเข้างานประจำ",
            RoutineImportRow: "แถวนำเข้างานประจำ",
        });
        expect(AUDIT_ENTITY_LABELS.ITTicket).toBe("ทิกเก็ต IT");
        expect(AUDIT_ENTITY_TYPE_OPTIONS).toContainEqual({
            value: "ITTicket",
            label: "ทิกเก็ต IT",
        });
    });

    it("presents the active Ticket accountability actions explicitly", () => {
        expect(AUDIT_ACTION_META).toMatchObject({
            TICKET_CREATE: { label: "สร้าง IT Ticket" },
            TICKET_UPDATE: { label: "แก้ไข IT Ticket" },
            TICKET_STATUS_CHANGE: { label: "เปลี่ยนสถานะ IT Ticket" },
            TICKET_ASSIGN: { label: "มอบหมาย IT Ticket" },
            TICKET_COMMENT: { label: "แสดงความคิดเห็นใน IT Ticket" },
        });
        expect("TICKET_DELETE" in AUDIT_ACTION_META).toBe(false);
        expect(getAuditActionLabel("TICKET_DELETE")).toBe("การดำเนินการอื่น ๆ");
    });
});
