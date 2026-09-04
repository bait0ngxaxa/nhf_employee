import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LeaveManagementSection } from "@/components/dashboard/sections/LeaveManagementSection";
import { LeaveManagementSectionSkeleton } from "@/components/dashboard/leave/LeaveSkeletons";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import type { DashboardPageSearchParams } from "@/lib/ssot/routes";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "Leave Management | NHFapp",
};

const LEAVE_TABS = new Set([
    "my-leave",
    "approvals",
    "recovery",
    "reports",
    "approver-settings",
]);

export default async function LeaveDashboardPage({
    searchParams,
}: {
    searchParams: Promise<DashboardPageSearchParams>;
}) {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        redirect(APP_ROUTES.dashboard);
    }

    const params = await searchParams;
    const requestedTab = params.leaveTab;
    const defaultTab =
        typeof requestedTab === "string" && LEAVE_TABS.has(requestedTab)
            ? requestedTab
            : undefined;

    return (
        <Suspense fallback={<LeaveManagementSectionSkeleton />}>
            <LeaveManagementSection defaultTab={defaultTab} />
        </Suspense>
    );
}
