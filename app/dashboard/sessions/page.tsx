import { Suspense } from "react";
import type { Metadata } from "next";

import { SessionManagementSection } from "@/components/dashboard/sections/SessionManagementSection";
import { SessionManagementSkeleton } from "@/components/dashboard/session-management/SessionManagementSkeleton";

export const metadata: Metadata = {
    title: "Session Management | NHFapp",
};

export default function SessionsDashboardPage() {
    return (
        <Suspense fallback={<SessionManagementSkeleton />}>
            <SessionManagementSection />
        </Suspense>
    );
}
