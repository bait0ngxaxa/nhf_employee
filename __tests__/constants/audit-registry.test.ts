import { AuditAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    AUDIT_ACTION_FILTER_OPTIONS,
    AUDIT_ACTION_META,
    AUDIT_ENTITY_LABELS,
} from "@/constants/audit";

describe("audit registry", () => {
    it("registers metadata and a filter option for every active AuditAction", () => {
        const legacyActions = new Set<AuditAction>([
            AuditAction.TICKET_CREATE,
            AuditAction.TICKET_UPDATE,
            AuditAction.TICKET_STATUS_CHANGE,
            AuditAction.TICKET_ASSIGN,
            AuditAction.TICKET_COMMENT,
            AuditAction.TICKET_DELETE,
        ]);
        const activeActions = Object.values(AuditAction)
            .filter((action) => !legacyActions.has(action))
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
    });
});
