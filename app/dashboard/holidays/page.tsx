import type { ReactElement } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireApiSession } from "@/lib/auth/api";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { HolidayCalendarPage } from "@/modules/leave/client";
import { isHolidayCalendarEnforced } from "@/modules/leave";

export const metadata: Metadata = { title: "ปฏิทินวันหยุดองค์กร | NHFapp" };

export default async function HolidaysPage(): Promise<ReactElement> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) notFound();
    const auth = await requireApiSession();
    if (!auth.ok) redirect(APP_ROUTES.login);
    return <HolidayCalendarPage isAdmin={auth.user.role === "ADMIN"} calendarEnforced={isHolidayCalendarEnforced()} />;
}
