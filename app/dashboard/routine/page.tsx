import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RoutineSection } from "@/components/dashboard/sections/RoutineSection";
import { RoutineSectionSkeleton } from "@/components/dashboard/routine/RoutineSkeletons";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "NHF Routine | NHFapp",
};

export default function RoutineDashboardPage() {
    if (!isFeatureEnabled(FEATURE_KEYS.routine)) {
        redirect(APP_ROUTES.dashboard);
    }

    return (
        <Suspense fallback={<RoutineSectionSkeleton />}>
            <RoutineSection />
        </Suspense>
    );
}
