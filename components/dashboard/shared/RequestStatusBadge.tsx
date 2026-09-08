import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui/utils";

export type RequestStatusMeta = {
    label: string;
    colorClass: string;
    iconClass: string;
    icon: LucideIcon;
};

interface RequestStatusBadgeProps {
    meta: RequestStatusMeta;
    className?: string;
}

export function RequestStatusBadge({
    meta,
    className,
}: RequestStatusBadgeProps) {
    const StatusIcon = meta.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1.5 px-2.5 py-0.5 font-medium transition-colors shadow-sm",
                meta.colorClass,
                className
            )}
        >
            <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", meta.iconClass)} />
            {meta.label}
        </Badge>
    );
}
