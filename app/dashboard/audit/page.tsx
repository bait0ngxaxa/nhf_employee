import { Suspense } from "react";
import type { Metadata } from "next";

import { AuditLogsSection } from "@/components/dashboard/sections/AuditLogsSection";
import { AuditLogsSectionSkeleton } from "@/components/audit/AuditLogSkeletons";
import { requireDashboardAdmin } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "Audit Logs | NHFapp",
};

export default async function AuditDashboardPage() {
    await requireDashboardAdmin();

    return (
        <Suspense fallback={<AuditLogsSectionSkeleton />}>
            <AuditLogsSection />
        </Suspense>
    );
}
