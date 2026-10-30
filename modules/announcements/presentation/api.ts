import { apiGet, apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { AnnouncementMutation, AnnouncementState } from "../domain/contracts";

export async function loadManagedAnnouncement(): Promise<AnnouncementState> {
    const result = await apiGet<{ announcement: AnnouncementState }>(API_ROUTES.announcements.manage, { cache: "no-store" });
    if (!result.success) throw new Error(result.errorThai);
    return result.data.announcement;
}

export async function saveAnnouncement(input: AnnouncementMutation): Promise<AnnouncementState> {
    const result = await apiPost<{ announcement: AnnouncementState }>(API_ROUTES.announcements.manage, input);
    if (!result.success) throw new Error(result.status === 409
        ? "มีผู้ดูแลแก้ไขประกาศแล้ว ข้อความที่คุณพิมพ์ยังอยู่ กรุณาคัดลอกไว้แล้วกดโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง"
        : result.errorThai);
    return result.data.announcement;
}
