import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { LIFF_API_REQUEST_OPTIONS, unwrapLiffResponse } from "@/modules/line/client";
import type { LeaveCalculationPreview } from "../../domain/calendar-calculation";
import type { LeaveRequestValues } from "../../schemas/leave";

export type LeavePreviewInput = Pick<LeaveRequestValues, "startDate" | "endDate" | "period" | "leaveType">;

function query(input: LeavePreviewInput): string {
    return new URLSearchParams(input).toString();
}

export async function fetchDashboardLeavePreview(input: LeavePreviewInput): Promise<LeaveCalculationPreview> {
    const result = await apiGet<LeaveCalculationPreview>(`${API_ROUTES.leave.calculation}?${query(input)}`);
    if (!result.success) throw new Error(result.errorThai || "ตรวจสอบวันลาไม่สำเร็จ");
    return result.data;
}

export async function fetchLiffLeavePreview(input: LeavePreviewInput): Promise<LeaveCalculationPreview> {
    return unwrapLiffResponse(await apiGet<LeaveCalculationPreview>(`${API_ROUTES.line.leaveCalculation}?${query(input)}`, LIFF_API_REQUEST_OPTIONS), (error) => error.errorThai || "ตรวจสอบวันลาไม่สำเร็จ");
}
