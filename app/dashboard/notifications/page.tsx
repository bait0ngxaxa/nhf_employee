import { Suspense } from "react";
import type { Metadata } from "next";

import {
    NotificationSectionSkeleton,
    NotificationsSection,
} from "@/modules/notification/client";

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
