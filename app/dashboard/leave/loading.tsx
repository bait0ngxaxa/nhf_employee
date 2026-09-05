import type { ReactElement } from "react";

import { LeaveManagementSectionSkeleton } from "@/modules/leave/client";

export default function LeaveLoading(): ReactElement {
    return <LeaveManagementSectionSkeleton />;
}
