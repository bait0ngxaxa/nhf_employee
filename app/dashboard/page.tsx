import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardHomeSection } from "@/components/dashboard/sections/DashboardHomeSection";
import { DashboardHomeSkeleton } from "@/components/dashboard/feedback/SectionSkeleton";
import {
    resolveLegacyDashboardRedirect,
    type DashboardPageSearchParams,
} from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "Dashboard | NHFapp",
    description: "Employee Management Dashboard for NHF",
};

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<DashboardPageSearchParams>;
}) {
    const legacyRedirect = resolveLegacyDashboardRedirect(await searchParams);
    if (legacyRedirect !== null) {
        redirect(legacyRedirect);
    }

    return (
        <Suspense fallback={<DashboardHomeSkeleton />}>
            <DashboardHomeSection />
        </Suspense>
    );
}
