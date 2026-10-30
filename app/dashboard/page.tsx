import { Suspense } from "react";
import { requireApiSession } from "@/lib/auth/api";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { getPublishedAnnouncement } from "@/modules/announcements";
import { AnnouncementTicker } from "@/modules/announcements/client";
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

async function DashboardAnnouncement(): Promise<React.ReactElement | null> {
    const auth = await requireApiSession();
    if (!auth.ok) redirect(APP_ROUTES.login);
    const announcement = await getPublishedAnnouncement();
    return announcement ? <AnnouncementTicker content={announcement.content} /> : null;
}

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
            <DashboardHomeSection announcement={<DashboardAnnouncement />} />
        </Suspense>
    );
}
