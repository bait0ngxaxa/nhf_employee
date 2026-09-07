import type { ReactElement } from "react";

import { AuditLogsSectionSkeleton } from "@/modules/audit/client";

export default function AuditLoading(): ReactElement {
    return <AuditLogsSectionSkeleton />;
}
