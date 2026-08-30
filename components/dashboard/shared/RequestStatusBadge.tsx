import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/utils";

type RequestStatusMeta = {
    label: string;
    colorClass: string;
    iconClass: string;
    icon: typeof Clock3;
};

const REQUEST_STATUS_META: Record<string, RequestStatusMeta> = {
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
    REJECTED_LEGACY: {
        label: "ปฏิเสธ (เดิม)",
        colorClass: "bg-status-danger-surface text-status-danger-strong border-status-danger-border hover:bg-status-danger-surface-strong",
        iconClass: "text-status-danger-icon",
        icon: XCircle,
    },
};

export function getRequestStatusMeta(status: string): RequestStatusMeta {
    return REQUEST_STATUS_META[status] || REQUEST_STATUS_META.PENDING;
}

interface RequestStatusBadgeProps {
    status: string;
    className?: string;
}

export function RequestStatusBadge({
    status,
    className,
}: RequestStatusBadgeProps) {
    const config = getRequestStatusMeta(status);
    const StatusIcon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1.5 px-2.5 py-0.5 font-medium transition-colors shadow-sm",
                config.colorClass,
                className
            )}
        >
            <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", config.iconClass)} />
            {config.label}
        </Badge>
    );
}
