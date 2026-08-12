import { apiGet, type ApiResponse } from "@/lib/client/api-client";
import {
    LIFF_API_REQUEST_OPTIONS,
    unwrapLiffResponse,
} from "@/lib/client/liff";
import type {
    LiffRoutineSummary,
    LiffRoutineTasksResponse,
} from "@/lib/line/routine-types";
import type { RoutineTimingStatus } from "@/lib/routine/timing";
import { API_ROUTES } from "@/lib/ssot/routes";

export type {
    LiffRoutineSummary,
    LiffRoutineTaskWorkItem,
    LiffRoutineTasksResponse,
    LiffRoutineTimingFilter,
} from "@/lib/line/routine-types";

function getRoutineApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
): string {
    switch (response.status) {
        case 401:
            return "การยืนยันตัวตนหมดอายุ กรุณาลองใหม่อีกครั้ง";
        case 403:
            return "บัญชี NHF นี้ยังไม่สามารถเข้าถึง Routine ได้";
        case 404:
            return "ขณะนี้ยังไม่เปิดใช้งาน Routine ผ่าน LIFF";
        case 409:
            return "บัญชี LINE หรือบัญชี NHF นี้ถูกเชื่อมกับบัญชีอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ";
        default:
            return response.errorThai || "ไม่สามารถเชื่อมต่อข้อมูล Routine ได้";
    }
}

export async function fetchLiffRoutineSummary(): Promise<{
    summary: LiffRoutineSummary;
}> {
    return unwrapLiffResponse(
        await apiGet<{ summary: LiffRoutineSummary }>(
            API_ROUTES.line.routineSummary,
            LIFF_API_REQUEST_OPTIONS,
        ),
        getRoutineApiErrorMessage,
    );
}

export async function fetchLiffRoutineTasks(input: {
    page: number;
    limit: number;
    timingStatus?: RoutineTimingStatus;
    taskId?: number;
    occurrenceId?: number;
}): Promise<LiffRoutineTasksResponse> {
    const params = new URLSearchParams({
        page: String(input.page),
        limit: String(input.limit),
    });
    if (input.timingStatus) {
        params.set("timingStatus", input.timingStatus);
    }
    if (input.taskId !== undefined) {
        params.set("taskId", String(input.taskId));
    }
    if (input.occurrenceId !== undefined) {
        params.set("occurrenceId", String(input.occurrenceId));
    }

    return unwrapLiffResponse(
        await apiGet<LiffRoutineTasksResponse>(
            `${API_ROUTES.line.routineTasks}?${params.toString()}`,
            LIFF_API_REQUEST_OPTIONS,
        ),
        getRoutineApiErrorMessage,
    );
}
