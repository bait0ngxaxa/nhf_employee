import { Suspense } from "react";
import type { Metadata } from "next";

import { NotificationSectionSkeleton } from "@/components/dashboard/feedback/SectionSkeleton";
import { NotificationsSection } from "@/components/dashboard/notifications/NotificationsPageContent";

export const metadata: Metadata = {
    title: "Notifications | NHFapp",
};

export default function NotificationsDashboardPage() {
    return (
        <Suspense fallback={<NotificationSectionSkeleton />}>
            <NotificationsSection />
        </Suspense>
    );
}
