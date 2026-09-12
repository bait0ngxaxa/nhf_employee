import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
    RoutineSection,
    RoutineSectionSkeleton,
} from "@/modules/routine/client";
import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "NHF Routine | NHFapp",
};

export default async function RoutineDashboardPage(): Promise<React.ReactElement> {
    if (!isFeatureEnabled(FEATURE_KEYS.routine)) {
        redirect(APP_ROUTES.dashboard);
    }

    const user = await getCurrentUserProjection();
    if (!user) {
        redirect(APP_ROUTES.login);
    }
    if (user.routineCapabilities?.canReadTasks !== true) {
        redirect(APP_ROUTES.accessDenied);
    }

    return (
        <Suspense fallback={<RoutineSectionSkeleton />}>
            <RoutineSection />
        </Suspense>
    );
}
