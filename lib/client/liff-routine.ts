import { apiGet, apiPost, type ApiResponse } from "@/lib/client/api-client";
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

export interface LiffSessionResponse {
    linked: boolean;
}

export class LiffApiError extends Error {
    readonly status: number | undefined;

    constructor(message: string, status: number | undefined) {
        super(message);
        this.name = "LiffApiError";
        this.status = status;
    }
}

function getSafeApiErrorMessage(
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

async function unwrapResponse<T>(response: ApiResponse<T>): Promise<T> {
    if (response.success) return response.data;
    throw new LiffApiError(
        getSafeApiErrorMessage(response),
        response.status,
    );
}

const NO_HYBRID_REFRESH = {
    retryCount: 0,
    skipAuthRefresh: true,
} as const;

export async function establishLiffSession(
    idToken: string,
): Promise<LiffSessionResponse> {
    return unwrapResponse(
        await apiPost<LiffSessionResponse>(
            API_ROUTES.line.liffSession,
            { idToken },
            NO_HYBRID_REFRESH,
        ),
    );
}

export async function linkLiffAccount(
    idToken: string,
): Promise<LiffSessionResponse> {
    return unwrapResponse(
        await apiPost<LiffSessionResponse>(
            API_ROUTES.line.accountLink,
            { idToken },
            NO_HYBRID_REFRESH,
        ),
    );
}

export async function fetchLiffRoutineSummary(): Promise<{
    summary: LiffRoutineSummary;
}> {
    return unwrapResponse(
        await apiGet<{ summary: LiffRoutineSummary }>(
            API_ROUTES.line.routineSummary,
            NO_HYBRID_REFRESH,
        ),
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

    return unwrapResponse(
        await apiGet<LiffRoutineTasksResponse>(
            `${API_ROUTES.line.routineTasks}?${params.toString()}`,
            NO_HYBRID_REFRESH,
        ),
    );
}
