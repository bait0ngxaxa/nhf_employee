import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { describe, expect, it } from "vitest";

import { getStockRequestStatusMeta } from "../presentation/status-meta";

describe("Stock request status presentation", () => {
    it.each([
        ["PENDING_ISSUE", "รอจ่าย", Clock3, "text-status-warning-icon"],
        ["ISSUED", "จ่ายแล้ว", CheckCircle2, "text-status-success-icon"],
        ["CANCELLED", "ยกเลิก", Ban, "text-content-muted"],
        ["REJECTED_LEGACY", "ปฏิเสธ (เดิม)", XCircle, "text-status-danger-icon"],
    ])("preserves the %s Stock presentation", (status, label, icon, iconClass) => {
        const meta = getStockRequestStatusMeta(status);

        expect(meta).toMatchObject({ label, icon, iconClass });
        expect(meta.colorClass).toContain("border-");
    });
});
