import type { Metadata } from "next";
import type { ReactElement } from "react";

import { requireDashboardITAnalyticsAccess } from "@/app/dashboard/_lib/route-access";
import { ITAnalyticsDashboard } from "@/modules/it/client";

export const metadata: Metadata = {
    title: "รายงาน IT | NHFapp",
};

export default async function ITAnalyticsPage(): Promise<ReactElement> {
    await requireDashboardITAnalyticsAccess();
    return <ITAnalyticsDashboard />;
}
