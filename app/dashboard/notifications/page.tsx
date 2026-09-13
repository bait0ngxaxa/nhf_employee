import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { APP_ROUTES } from "@/lib/ssot/routes";
import {
    NotificationSectionSkeleton,
    NotificationsSection,
} from "@/modules/notification/client";

export const metadata: Metadata = {
    title: "Notifications | NHFapp",
};

export default async function NotificationsDashboardPage() {
    const user = await getCurrentUserProjection();
    if (!user) {
        redirect(APP_ROUTES.login);
    }
    if (user.notificationCapabilities?.canReadInbox !== true) {
        redirect(APP_ROUTES.accessDenied);
    }

    return (
        <Suspense fallback={<NotificationSectionSkeleton />}>
            <NotificationsSection
                canReadInbox={user.notificationCapabilities?.canReadInbox === true}
                canUpdateInbox={user.notificationCapabilities?.canUpdateInbox === true}
            />
        </Suspense>
    );
}
