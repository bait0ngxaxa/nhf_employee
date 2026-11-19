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
} from "@/modules/line/client";
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
    accessDenied: string,
): string {
    switch (response.status) {
        case 401:
            return isRecoveredLiffUnauthorizedResponse(response)
                ? LIFF_SESSION_RECOVERED_MUTATION_MESSAGE
                : "กรุณาเปิด NHFapp จาก LINE อีกครั้งเพื่อเข้าสู่ระบบ";
        case 403:
            return accessDenied;
        case 404:
            return response.error === ROUTINE_API_MESSAGES.liffFeatureDisabled
                ? ROUTINE_API_MESSAGES.liffFeatureDisabled
                : ROUTINE_API_MESSAGES.liffResourceNotFound;
        case 409:
            return response.errorThai && response.errorThai === response.error
                ? response.errorThai
                : "ข้อมูลงานประจำเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุด";
        case 413:
            return "คำขอ Routine มีขนาดใหญ่เกินไป";
        case 429:
            return "คุณทำรายการ Routine ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
        case 400:
        case 422:
            return response.errorThai || "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
        default:
            if (response.status === undefined) {
                return response.code === "TIMEOUT"
                    ? "การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่"
                    : "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
            }
            return "บริการงานประจำไม่พร้อมใช้งานชั่วคราว กรุณาลองอีกครั้ง";
    }
}

async function unwrapRoutineResponse<T>(
    response: ApiResponse<T>,
    accessDenied: string,
): Promise<T> {
    return unwrapLiffResponse(response, (failure) => getRoutineApiErrorMessage(failure, accessDenied));
}

export async function fetchLiffRoutineSummary(): Promise<{
    summary: LiffRoutineSummary;
}> {
    return unwrapRoutineResponse(
        await apiGet<{ summary: LiffRoutineSummary }>(
            API_ROUTES.line.routineSummary,
            LIFF_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดสรุปงานประจำไม่ได้",
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

    return unwrapRoutineResponse(
        await apiGet<LiffRoutineTasksResponse>(
            `${API_ROUTES.line.routineTasks}?${params.toString()}`,
            LIFF_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดรายการงานประจำไม่ได้",
    );
}

export async function fetchLiffRoutineReference(): Promise<LiffRoutineReferenceData> {
    return unwrapRoutineResponse(
        await apiGet<LiffRoutineReferenceData>(
            API_ROUTES.line.routineReference,
            LIFF_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดข้อมูลสำหรับจัดการงานประจำไม่ได้",
    );
}

export async function fetchLiffRoutineTask(
    taskId: number | string,
): Promise<LiffRoutineTaskDetailResponse> {
    return unwrapRoutineResponse(
        await apiGet<LiffRoutineTaskDetailResponse>(
            API_ROUTES.line.routineTaskById(taskId),
            LIFF_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดรายละเอียดงานประจำไม่ได้",
    );
}

export async function createLiffRoutineTask(
    payload: LiffRoutineTaskCreateInput,
    idempotencyKey: string,
): Promise<LiffRoutineTaskCreateResponse> {
    return unwrapRoutineResponse(
        await apiPost<LiffRoutineTaskCreateResponse>(
            API_ROUTES.line.routineTasks,
            payload,
            {
                ...LIFF_API_REQUEST_OPTIONS,
                headers: { "Idempotency-Key": idempotencyKey },
            },
        ),
        "บัญชีนี้สร้างงานประจำไม่ได้",
    );
}

export async function updateLiffRoutineTask(
    taskId: number | string,
    payload: LiffRoutineTaskUpdateInput,
): Promise<LiffRoutineTaskMutationResponse> {
    return unwrapRoutineResponse(
        await apiPatch<LiffRoutineTaskMutationResponse>(
            API_ROUTES.line.routineTaskById(taskId),
            payload,
            LIFF_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้แก้ไขงานประจำไม่ได้",
    );
}

export async function deleteLiffRoutineTask(
    taskId: number | string,
): Promise<void> {
    await unwrapRoutineResponse(
        await apiDelete<{ success: true }>(
            API_ROUTES.line.routineTaskById(taskId),
            LIFF_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้ลบงานประจำไม่ได้",
    );
}
