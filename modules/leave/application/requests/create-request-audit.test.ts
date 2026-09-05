import { describe, expect, it } from "vitest";

import { formatAuditLogDisplay } from "@/lib/audit-log/display";
import { buildCreatedLeaveRequestAuditDetails } from "./create-request-audit";

describe("Leave creation audit details", () => {
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
});
