import {
    apiDelete,
    apiGet,
    apiPatch,
    apiPost,
    type ApiResponse,
} from "@/lib/client/api-client";
import {
    isRecoveredLiffUnauthorizedResponse,
    LIFF_API_REQUEST_OPTIONS,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    unwrapLiffResponse,
} from "@/lib/client/liff";
import type {
    LiffRoutineReferenceData,
    LiffRoutineSummary,
    LiffRoutineTaskCreateResponse,
    LiffRoutineTaskDetailResponse,
    LiffRoutineTaskMutationResponse,
    LiffRoutineTasksResponse,
} from "./types";
import type { RoutineTimingStatus } from "../../domain/timing";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ROUTINE_API_MESSAGES } from "@/lib/ssot/messages";
import type {
    LiffRoutineTaskCreateInput,
    LiffRoutineTaskUpdateInput,
} from "../../schemas/liff";

export type {
    LiffRoutineSummary,
    LiffRoutineReferenceData,
    LiffRoutineTaskCreateResponse,
    LiffRoutineTaskDetail,
    LiffRoutineTaskDetailResponse,
    LiffRoutineTaskMutationResponse,
    LiffRoutineTaskWorkItem,
    LiffRoutineTasksResponse,
    LiffRoutineTimingFilter,
} from "./types";
export type {
    LiffRoutineTaskCreateInput,
    LiffRoutineTaskUpdateInput,
} from "../../schemas/liff";

function getRoutineApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
): string {
    switch (response.status) {
        case 401:
            return isRecoveredLiffUnauthorizedResponse(response)
                ? LIFF_SESSION_RECOVERED_MUTATION_MESSAGE
                : "การยืนยันตัวตนหมดอายุ กรุณาลองใหม่อีกครั้ง";
        case 403:
            return "บัญชี NHF นี้ยังไม่สามารถเข้าถึง Routine ได้";
        case 404:
            return response.errorThai || ROUTINE_API_MESSAGES.liffResourceNotFound;
        case 409:
            return response.errorThai || "ข้อมูล Routine เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่";
        case 413:
            return "คำขอ Routine มีขนาดใหญ่เกินไป";
        case 429:
            return "คุณทำรายการ Routine ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
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

export async function fetchLiffRoutineReference(): Promise<LiffRoutineReferenceData> {
    return unwrapLiffResponse(
        await apiGet<LiffRoutineReferenceData>(
            API_ROUTES.line.routineReference,
            LIFF_API_REQUEST_OPTIONS,
        ),
        getRoutineApiErrorMessage,
    );
}

export async function fetchLiffRoutineTask(
    taskId: number | string,
): Promise<LiffRoutineTaskDetailResponse> {
    return unwrapLiffResponse(
        await apiGet<LiffRoutineTaskDetailResponse>(
            API_ROUTES.line.routineTaskById(taskId),
            LIFF_API_REQUEST_OPTIONS,
        ),
        getRoutineApiErrorMessage,
    );
}

export async function createLiffRoutineTask(
    payload: LiffRoutineTaskCreateInput,
    idempotencyKey: string,
): Promise<LiffRoutineTaskCreateResponse> {
    return unwrapLiffResponse(
        await apiPost<LiffRoutineTaskCreateResponse>(
            API_ROUTES.line.routineTasks,
            payload,
            {
                ...LIFF_API_REQUEST_OPTIONS,
                headers: { "Idempotency-Key": idempotencyKey },
            },
        ),
        getRoutineApiErrorMessage,
    );
}

export async function updateLiffRoutineTask(
    taskId: number | string,
    payload: LiffRoutineTaskUpdateInput,
): Promise<LiffRoutineTaskMutationResponse> {
    return unwrapLiffResponse(
        await apiPatch<LiffRoutineTaskMutationResponse>(
            API_ROUTES.line.routineTaskById(taskId),
            payload,
            LIFF_API_REQUEST_OPTIONS,
        ),
        getRoutineApiErrorMessage,
    );
}

export async function deleteLiffRoutineTask(
    taskId: number | string,
): Promise<void> {
    await unwrapLiffResponse(
        await apiDelete<{ success: true }>(
            API_ROUTES.line.routineTaskById(taskId),
            LIFF_API_REQUEST_OPTIONS,
        ),
        getRoutineApiErrorMessage,
    );
}
