import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
    canAccessLeaveDashboard,
    normalizeLeaveDashboardTab,
} from "@/constants/dashboard";
import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import {
    LeaveManagementSection,
    LeaveManagementSectionSkeleton,
} from "@/modules/leave/client";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import type { DashboardPageSearchParams } from "@/lib/ssot/routes";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "Leave Management | NHFapp",
};

export default async function LeaveDashboardPage({
    searchParams,
}: {
    searchParams: Promise<DashboardPageSearchParams>;
}) {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        redirect(APP_ROUTES.dashboard);
    }

    const user = await getCurrentUserProjection();
    if (!user) {
        redirect(APP_ROUTES.login);
    }

    const leaveAvailability = {
        leaveCapabilities: user.leaveCapabilities,
        canApproveLeave: user.canApproveLeave,
        canViewLeaveReports: user.canViewLeaveReports,
    };
    if (!canAccessLeaveDashboard(leaveAvailability)) {
        redirect(APP_ROUTES.accessDenied);
    }

    const params = await searchParams;
    const requestedTab = params.leaveTab;
    const routeTab = normalizeLeaveDashboardTab(
        typeof requestedTab === "string" ? requestedTab : undefined,
        leaveAvailability,
    );

    return (
        <Suspense fallback={<LeaveManagementSectionSkeleton />}>
            <LeaveManagementSection routeTab={routeTab} />
        </Suspense>
    );
}
