import { Ban, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RequestStatusMeta = {
    label: string;
    colorClass: string;
    iconClass: string;
    icon: typeof Clock3;
};

const REQUEST_STATUS_META: Record<string, RequestStatusMeta> = {
    PENDING: {
        label: "รออนุมัติ",
        colorClass: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
        iconClass: "text-amber-500",
        icon: Clock3,
    },
    APPROVED: {
        label: "อนุมัติแล้ว",
        colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
        iconClass: "text-emerald-500",
        icon: CheckCircle2,
    },
    REJECTED: {
        label: "ปฏิเสธ",
        colorClass: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
        iconClass: "text-rose-500",
        icon: XCircle,
    },
    CANCELLED: {
        label: "ยกเลิก",
        colorClass: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
        iconClass: "text-slate-500",
        icon: Ban,
    },
    PENDING_ISSUE: {
        label: "รอจ่าย",
        colorClass: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
        iconClass: "text-amber-500",
        icon: Clock3,
    },
    ISSUED: {
        label: "จ่ายแล้ว",
        colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
        iconClass: "text-emerald-500",
        icon: CheckCircle2,
    },
    REJECTED_LEGACY: {
        label: "ปฏิเสธ (เดิม)",
        colorClass: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
        iconClass: "text-rose-500",
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
