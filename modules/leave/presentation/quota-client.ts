import { z } from "zod";
import { apiGet } from "@/lib/client/api-client";
import { LIFF_API_REQUEST_OPTIONS } from "@/modules/line/client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { HolidayReferenceChannel } from "./holiday-reference-client";

const quotaSchema = z.object({
    year: z.number().int(),
    leaveType: z.enum(["SICK", "PERSONAL", "VACATION"]),
    effectiveTotalDays: z.number().finite(),
    usedDays: z.number().nonnegative().finite(),
    remainingDays: z.number().finite(),
});
export type LeaveQuotaSnapshot = z.infer<typeof quotaSchema>;

export async function fetchLeaveQuotaProjection(channel: HolidayReferenceChannel, year: number): Promise<LeaveQuotaSnapshot[]> {
    const route = channel === "liff" ? API_ROUTES.line.leaveMe : API_ROUTES.leave.me;
    const response = await apiGet<unknown>(`${route}?quotaYear=${year}`, {
        ...(channel === "liff" ? LIFF_API_REQUEST_OPTIONS : {}),
        cache: "no-store", retryCount: 0,
    });
    if (!response.success) throw new Error("ไม่สามารถตรวจสอบสิทธิ์ลาได้ กรุณาลองใหม่");
    return z.object({ quotas: z.array(quotaSchema) }).parse(response.data).quotas;
}
