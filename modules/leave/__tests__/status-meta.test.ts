import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { describe, expect, it } from "vitest";

import { getLeaveRequestStatusMeta } from "../presentation/status-meta";

describe("Leave request status presentation", () => {
    it.each([
        ["PENDING", "รออนุมัติ", Clock3, "text-status-warning-icon"],
        ["APPROVED", "อนุมัติแล้ว", CheckCircle2, "text-status-success-icon"],
        ["REJECTED", "ปฏิเสธ", XCircle, "text-status-danger-icon"],
        ["CANCELLED", "ยกเลิก", Ban, "text-content-muted"],
        ["NOT_TAKEN", "ไม่ได้ใช้วันลา", Ban, "text-status-info-icon"],
        ["CANCELLATION_REQUESTED", "รอยืนยันยกเลิก", Clock3, "text-status-warning-icon"],
        ["CANCELLED_AFTER_APPROVAL", "ยกเลิกหลังอนุมัติ", Ban, "text-content-muted"],
    ])("preserves the %s Leave presentation", (status, label, icon, iconClass) => {
        const meta = getLeaveRequestStatusMeta(status);

        expect(meta).toMatchObject({ label, icon, iconClass });
        expect(meta.colorClass).toContain("border-");
    });
});
