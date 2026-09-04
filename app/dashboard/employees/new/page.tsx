import { Suspense } from "react";
import type { Metadata } from "next";

import { AddEmployeeSection } from "@/components/dashboard/sections/AddEmployeeSection";
import { FormSectionSkeleton } from "@/components/dashboard/feedback/SectionSkeleton";
import { requireDashboardAdmin } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "Add Employee | NHFapp",
};

export default async function AddEmployeeDashboardPage() {
    await requireDashboardAdmin();

    return (
        <Suspense fallback={<FormSectionSkeleton />}>
            <AddEmployeeSection />
        </Suspense>
    );
}
