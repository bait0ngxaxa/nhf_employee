import { Suspense } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    const user = await getCurrentUserProjection();
    if (!user) {
        redirect(APP_ROUTES.login);
    }

    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        return (
            <section className="mx-auto w-full max-w-3xl rounded-xl border border-border-subtle bg-surface-raised p-6 sm:p-8" aria-labelledby="leave-unavailable-title">
                <CalendarRange className="size-6 text-content-muted" aria-hidden="true" />
                <h1 id="leave-unavailable-title" data-page-heading tabIndex={-1} className="mt-4 text-2xl font-bold text-content-heading">NHF Leave</h1>
                <p className="mt-2 font-semibold text-content-heading">ยังไม่พร้อมให้บริการ</p>
                <p className="mt-2 text-sm leading-6 text-content-secondary">ระบบการลายังไม่เปิดให้ใช้งานในขณะนี้</p>
                <Button asChild variant="outline" className="mt-6"><Link href={APP_ROUTES.dashboard}>กลับหน้าหลัก</Link></Button>
            </section>
        );
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
