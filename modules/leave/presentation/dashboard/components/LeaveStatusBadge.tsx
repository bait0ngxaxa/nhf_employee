import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { getLeaveRequestStatusMeta } from "../../status-meta";

interface LeaveStatusBadgeProps {
    status: string;
}

export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
    return <RequestStatusBadge meta={getLeaveRequestStatusMeta(status)} />;
}
