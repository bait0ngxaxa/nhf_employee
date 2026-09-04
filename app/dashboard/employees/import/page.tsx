import { Suspense } from "react";
import type { Metadata } from "next";

import { ImportSectionSkeleton } from "@/components/dashboard/feedback/SectionSkeleton";
import { requireDashboardAdmin } from "@/app/dashboard/_lib/route-access";
import { ImportEmployeeRouteContent } from "./ImportEmployeeRouteContent";

export const metadata: Metadata = {
    title: "Import Employee CSV | NHFapp",
};

export default async function ImportEmployeeDashboardPage() {
    await requireDashboardAdmin();

    return (
        <Suspense fallback={<ImportSectionSkeleton />}>
            <ImportEmployeeRouteContent />
        </Suspense>
    );
}
