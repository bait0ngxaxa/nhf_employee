import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";

import type { RequestStatusMeta } from "@/components/dashboard/shared/RequestStatusBadge";

const LEAVE_STATUS_META: Record<string, RequestStatusMeta> = {
    PENDING: {
        label: "รออนุมัติ",
        colorClass: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border hover:bg-status-warning-surface-strong",
        iconClass: "text-status-warning-icon",
        icon: Clock3,
    },
    APPROVED: {
        label: "อนุมัติแล้ว",
        colorClass: "bg-status-success-surface text-status-success-foreground border-status-success-border hover:bg-status-success-surface-strong",
        iconClass: "text-status-success-icon",
        icon: CheckCircle2,
    },
    REJECTED: {
        label: "ปฏิเสธ",
        colorClass: "bg-status-danger-surface text-status-danger-strong border-status-danger-border hover:bg-status-danger-surface-strong",
        iconClass: "text-status-danger-icon",
        icon: XCircle,
    },
    CANCELLED: {
        label: "ยกเลิก",
        colorClass: "bg-surface-subtle text-content-body border-border-subtle hover:bg-surface-muted",
        iconClass: "text-content-muted",
        icon: Ban,
    },
    NOT_TAKEN: {
        label: "ไม่ได้ใช้วันลา",
        colorClass: "bg-status-info-surface text-status-info-foreground border-status-info-border hover:bg-status-info-surface-strong",
        iconClass: "text-status-info-icon",
        icon: Ban,
    },
    CANCELLATION_REQUESTED: {
        label: "รอยืนยันยกเลิก",
        colorClass: "bg-status-warning-surface text-status-warning-foreground border-status-warning-border hover:bg-status-warning-surface-strong",
        iconClass: "text-status-warning-icon",
        icon: Clock3,
    },
    CANCELLED_AFTER_APPROVAL: {
        label: "ยกเลิกหลังอนุมัติ",
        colorClass: "bg-surface-subtle text-content-body border-border-subtle hover:bg-surface-muted",
        iconClass: "text-content-muted",
        icon: Ban,
    },
};

export function getLeaveRequestStatusMeta(status: string): RequestStatusMeta {
    return LEAVE_STATUS_META[status] ?? LEAVE_STATUS_META.PENDING;
}
