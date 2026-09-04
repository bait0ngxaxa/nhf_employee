import type { ReactElement } from "react";

import { LeaveManagementSectionSkeleton } from "@/components/dashboard/leave/LeaveSkeletons";

export default function LeaveLoading(): ReactElement {
    return <LeaveManagementSectionSkeleton />;
}
