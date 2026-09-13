import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { canAccessEmployeeDashboard } from "@/constants/dashboard";
import { APP_ROUTES } from "@/lib/ssot/routes";
import {
    EmployeeManagementSection,
    EmployeeManagementSectionSkeleton,
} from "@/modules/employee/client";

export const metadata: Metadata = {
    title: "Employee Management | NHFapp",
};

export default async function EmployeesDashboardPage(): Promise<React.ReactElement> {
    const user = await getCurrentUserProjection();
    if (!user) {
        redirect(APP_ROUTES.login);
    }
    if (!canAccessEmployeeDashboard(user.employeeCapabilities)) {
        redirect(APP_ROUTES.accessDenied);
    }

    return (
        <Suspense fallback={<EmployeeManagementSectionSkeleton />}>
            <EmployeeManagementSection />
        </Suspense>
    );
}
