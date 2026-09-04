import { Suspense } from "react";
import type { Metadata } from "next";

import { EmailRequestSection } from "@/components/dashboard/sections/EmailRequestSection";
import { EmailRequestSectionSkeleton } from "@/components/dashboard/feedback/EmailRequestSectionSkeleton";
import { requireDashboardAdmin } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "New Employee Request | NHFapp",
};

export default async function EmailRequestDashboardPage() {
    await requireDashboardAdmin();

    return (
        <Suspense fallback={<EmailRequestSectionSkeleton />}>
            <EmailRequestSection />
        </Suspense>
    );
}
