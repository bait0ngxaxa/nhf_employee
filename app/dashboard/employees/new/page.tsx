import { Suspense } from "react";
import type { Metadata } from "next";

import { AddEmployeeSection } from "@/modules/employee/client";
import { FormSectionSkeleton } from "@/components/dashboard/feedback/SectionSkeleton";
import { requireDashboardEmployeeCapability } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "Add Employee | NHFapp",
};

export default async function AddEmployeeDashboardPage() {
    await requireDashboardEmployeeCapability("canCreateEmployees");

    return (
        <Suspense fallback={<FormSectionSkeleton />}>
            <AddEmployeeSection />
        </Suspense>
    );
}
