import { Suspense } from "react";
import type { Metadata } from "next";

import { EmailRequestSection } from "@/components/dashboard/sections/EmailRequestSection";
import { EmailRequestSectionSkeleton } from "@/modules/it/client";
import { requireDashboardEmailRequestAccess } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "New Employee Request | NHFapp",
};

export default async function EmailRequestDashboardPage() {
    const capabilities = await requireDashboardEmailRequestAccess();

    return (
        <Suspense fallback={<EmailRequestSectionSkeleton />}>
            <EmailRequestSection capabilities={capabilities} />
        </Suspense>
    );
}
