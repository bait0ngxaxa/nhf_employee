import type { ReactElement } from "react";

import { AuditLogsSectionSkeleton } from "@/components/audit/AuditLogSkeletons";

export default function AuditLoading(): ReactElement {
    return <AuditLogsSectionSkeleton />;
}
