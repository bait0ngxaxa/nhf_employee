import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    getAuditActionBadgeClassName,
    getAuditActionLabel,
} from "@/constants/audit";

interface AuditActionBadgeProps {
    action: string;
    className?: string;
}

export function AuditActionBadge({ action, className }: AuditActionBadgeProps) {
    return (
        <Badge className={cn(getAuditActionBadgeClassName(action), className)}>
            {getAuditActionLabel(action)}
        </Badge>
    );
}
