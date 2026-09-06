import { Suspense } from "react";
import type { Metadata } from "next";

import {
    EmployeeManagementSection,
    EmployeeManagementSectionSkeleton,
} from "@/modules/employee/client";

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
