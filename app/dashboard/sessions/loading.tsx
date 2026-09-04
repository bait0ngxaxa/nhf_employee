import type { ReactElement } from "react";

import { SessionManagementSkeleton } from "@/components/dashboard/session-management/SessionManagementSkeleton";

export default function SessionsLoading(): ReactElement {
    return <SessionManagementSkeleton />;
}
