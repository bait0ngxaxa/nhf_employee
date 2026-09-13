import { Suspense } from "react";
import type { Metadata } from "next";

import {
    AuditLogsSection,
    AuditLogsSectionSkeleton,
} from "@/modules/audit/client";
import { requireDashboardAuditCapability } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "Audit Logs | NHFapp",
};

export default async function AuditDashboardPage() {
    await requireDashboardAuditCapability();

    return (
        <Suspense fallback={<AuditLogsSectionSkeleton />}>
            <AuditLogsSection />
        </Suspense>
    );
}
