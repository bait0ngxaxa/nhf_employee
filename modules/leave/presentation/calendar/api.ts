import { API_ROUTES } from "@/lib/ssot/routes";
import { fetchWithRefresh } from "@/modules/auth/client";
import { AUTH_MUTATION_HEADERS } from "@/lib/auth/mutation-headers";
import type { CalendarMutation, ManagedHolidayCalendar, PublishedHolidayCalendar } from "../../domain/holiday-calendar";
import type { CalendarImpactReport, CalendarReconcileInput, CalendarReconcileResult } from "../../domain/calendar-reconciliation";

async function readResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "โหลดปฏิทินไม่สำเร็จ กรุณาลองใหม่");
    return data as T;
}

export async function loadHolidayCalendar(year: number, admin: true): Promise<ManagedHolidayCalendar>;
export async function loadHolidayCalendar(year: number, admin: false): Promise<PublishedHolidayCalendar>;
export async function loadHolidayCalendar(year: number, admin: boolean): Promise<ManagedHolidayCalendar | PublishedHolidayCalendar>;
export async function loadHolidayCalendar(year: number, admin: boolean): Promise<ManagedHolidayCalendar | PublishedHolidayCalendar> {
    return readResponse(await fetchWithRefresh(`${admin ? API_ROUTES.leave.calendarManage : API_ROUTES.leave.calendar}?year=${year}`, { cache: "no-store" }));
}

export async function saveHolidayCalendar(input: CalendarMutation): Promise<ManagedHolidayCalendar> {
    return readResponse(await fetchWithRefresh(API_ROUTES.leave.calendarManage, { method: "POST", headers: { ...AUTH_MUTATION_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}

export async function loadCalendarImpact(year: number, versionId: string, cursor?: string): Promise<CalendarImpactReport> {
    const params = new URLSearchParams({ year: String(year), versionId, ...(cursor ? { cursor } : {}) });
    return readResponse(await fetchWithRefresh(`${API_ROUTES.leave.calendarImpact}?${params}`, { cache: "no-store" }));
}

export async function confirmCalendarReconciliation(input: CalendarReconcileInput): Promise<CalendarReconcileResult> {
    return readResponse(await fetchWithRefresh(API_ROUTES.leave.calendarReconcile, { method: "POST", headers: { ...AUTH_MUTATION_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}
