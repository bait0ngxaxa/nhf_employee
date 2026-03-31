import { AlertCircle, ArrowDown, ArrowUp, Ban, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getTicketPriorityLabel, getTicketStatusLabel } from "@/lib/helpers/ticket-helpers";

type TicketBadgeMeta = {
    className: string;
    iconClassName: string;
    icon: typeof AlertCircle;
};

const STATUS_META: Record<string, TicketBadgeMeta> = {
    OPEN: {
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
        iconClassName: "text-blue-500",
        icon: AlertCircle,
    },
    IN_PROGRESS: {
        className: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
        iconClassName: "text-amber-500",
        icon: Clock3,
    },
    RESOLVED: {
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
        iconClassName: "text-emerald-500",
        icon: CheckCircle2,
    },
    CLOSED: {
        className: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
        iconClassName: "text-slate-500",
        icon: Ban,
    },
    CANCELLED: {
        className: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
        iconClassName: "text-rose-500",
        icon: Ban,
    },
};

const PRIORITY_META: Record<string, TicketBadgeMeta> = {
    LOW: {
        className: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
        iconClassName: "text-slate-500",
        icon: ArrowDown,
    },
    MEDIUM: {
        className: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
        iconClassName: "text-sky-500",
        icon: Clock3,
    },
    HIGH: {
        className: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
        iconClassName: "text-orange-500",
        icon: ArrowUp,
    },
    URGENT: {
        className: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
        iconClassName: "text-red-500",
        icon: AlertCircle,
    },
};

const DEFAULT_META: TicketBadgeMeta = {
    className: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
    iconClassName: "text-slate-500",
    icon: Clock3,
};

function TicketMetaBadge({
    label,
    meta,
    className,
}: {
    label: string;
    meta: TicketBadgeMeta;
    className?: string;
}) {
    const MetaIcon = meta.icon;
    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1.5 px-2.5 py-0.5 font-medium transition-colors shadow-sm",
                meta.className,
                className,
            )}
        >
            <MetaIcon className={cn("h-3.5 w-3.5 shrink-0", meta.iconClassName)} />
            {label}
        </Badge>
    );
}

export function TicketStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    return (
        <TicketMetaBadge
            label={getTicketStatusLabel(status)}
            meta={STATUS_META[status] ?? DEFAULT_META}
            className={className}
        />
    );
}

export function TicketPriorityBadge({
    priority,
    className,
}: {
    priority: string;
    className?: string;
}) {
    return (
        <TicketMetaBadge
            label={getTicketPriorityLabel(priority)}
            meta={PRIORITY_META[priority] ?? DEFAULT_META}
            className={className}
        />
    );
}
