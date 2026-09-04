import { Suspense } from "react";
import type { Metadata } from "next";

import { EmployeeManagementSection } from "@/components/dashboard/sections/EmployeeManagementSection";
import { EmployeeManagementSectionSkeleton } from "@/components/employee/EmployeeSkeletons";

export const metadata: Metadata = {
    title: "Employee Management | NHFapp",
};

export default function EmployeesDashboardPage() {
    return (
        <Suspense fallback={<EmployeeManagementSectionSkeleton />}>
            <EmployeeManagementSection />
        </Suspense>
    );
}
