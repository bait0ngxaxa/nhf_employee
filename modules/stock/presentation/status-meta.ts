import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";

import type { RequestStatusMeta } from "@/components/dashboard/shared/RequestStatusBadge";

const STOCK_STATUS_META: Record<string, RequestStatusMeta> = {
    PENDING_ISSUE: {
        label: "รอจ่าย",
        colorClass: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border hover:bg-status-warning-surface-strong",
        iconClass: "text-status-warning-icon",
        icon: Clock3,
    },
    ISSUED: {
        label: "จ่ายแล้ว",
        colorClass: "bg-status-success-surface text-status-success-foreground border-status-success-border hover:bg-status-success-surface-strong",
        iconClass: "text-status-success-icon",
        icon: CheckCircle2,
    },
    CANCELLED: {
        label: "ยกเลิก",
        colorClass: "bg-surface-subtle text-content-body border-border-subtle hover:bg-surface-muted",
        iconClass: "text-content-muted",
        icon: Ban,
    },
    REJECTED_LEGACY: {
        label: "ปฏิเสธ (เดิม)",
        colorClass: "bg-status-danger-surface text-status-danger-strong border-status-danger-border hover:bg-status-danger-surface-strong",
        iconClass: "text-status-danger-icon",
        icon: XCircle,
    },
};

export function getStockRequestStatusMeta(status: string): RequestStatusMeta {
    return STOCK_STATUS_META[status] ?? STOCK_STATUS_META.PENDING_ISSUE;
}
