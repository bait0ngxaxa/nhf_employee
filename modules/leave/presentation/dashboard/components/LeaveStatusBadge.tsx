import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";

interface LeaveStatusBadgeProps {
    status: string;
}

export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
    return <RequestStatusBadge status={status} />;
}
