import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/api";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { getManagedAnnouncement } from "@/modules/announcements";
import { AnnouncementManager } from "@/modules/announcements/client";

export const metadata: Metadata = { title: "จัดการประกาศ | NHFapp" };

export default async function AnnouncementsPage(): Promise<React.ReactElement> {
    const auth = await requireAdminSession();
    if (!auth.ok) redirect(auth.response.status === 401 ? APP_ROUTES.login : APP_ROUTES.accessDenied);
    return <AnnouncementManager initialState={await getManagedAnnouncement(auth.user)} />;
}
