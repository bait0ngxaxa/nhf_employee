import {
    apiGet,
    apiPost,
    apiPut,
    type ApiResponse,
} from "@/lib/client/api-client";
import {
    fetchLiffWithSessionRecovery,
    isRecoveredLiffUnauthorizedResponse,
    LIFF_API_REQUEST_OPTIONS,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LiffApiError,
    unwrapLiffResponse,
} from "@/lib/client/liff";
import type { LeaveHistoryFilters } from "@/lib/services/leave/history-filters";
import { API_ROUTES } from "@/lib/ssot/routes";
import type {
    LiffLeaveApprovalsResponse,
    LiffLeaveProfileResponse,
    LiffLeaveRequestDetail,
} from "@/lib/types/leave";
import type { LeaveRequestValues } from "@/lib/validations/leave";

function getLeaveApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
): string {
    switch (response.status) {
        case 401:
            return isRecoveredLiffUnauthorizedResponse(response)
                ? LIFF_SESSION_RECOVERED_MUTATION_MESSAGE
                : "การยืนยันตัวตนหมดอายุ กรุณาเปิด NHFapp จาก LINE อีกครั้ง";
        case 403:
            return "คุณไม่มีสิทธิ์ดำเนินการกับคำขอลานี้";
        case 404:
            return response.errorThai || "ไม่พบรายการลา หรือยังไม่เปิดใช้งาน Leave";
        case 409:
            return response.errorThai || "สถานะคำขอลาเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่";
        case 413:
            return "ไฟล์แนบหรือคำขอมีขนาดใหญ่เกินไป";
        default:
            return response.errorThai || "ไม่สามารถเชื่อมต่อข้อมูล Leave ได้";
    }
}

async function unwrapLeaveResponse<T>(response: ApiResponse<T>): Promise<T> {
    return unwrapLiffResponse(response, getLeaveApiErrorMessage);
}

export async function fetchLiffLeaveProfile(input: {
    page: number;
    filters?: LeaveHistoryFilters;
}): Promise<LiffLeaveProfileResponse> {
    const params = new URLSearchParams({ page: String(input.page) });
    const filters = input.filters ?? {};
    if (filters.query?.trim()) params.set("q", filters.query.trim());
    if (filters.leaveType) params.set("leaveType", filters.leaveType);
    if (filters.status) params.set("status", filters.status);
    if (filters.year !== undefined) params.set("year", String(filters.year));

    return unwrapLeaveResponse(
        await apiGet<LiffLeaveProfileResponse>(
            `${API_ROUTES.line.leaveMe}?${params.toString()}`,
            LIFF_API_REQUEST_OPTIONS,
        ),
    );
}

export async function fetchLiffLeaveApprovals(input: {
    pendingPage: number;
    notTakenPage: number;
    cancellationPage: number;
}): Promise<LiffLeaveApprovalsResponse> {
    const params = new URLSearchParams({
        pendingPage: String(input.pendingPage),
        notTakenPage: String(input.notTakenPage),
        cancellationPage: String(input.cancellationPage),
    });
    return unwrapLeaveResponse(
        await apiGet<LiffLeaveApprovalsResponse>(
            `${API_ROUTES.line.leaveApprovals}?${params.toString()}`,
            LIFF_API_REQUEST_OPTIONS,
        ),
    );
}

export async function fetchLiffLeaveRequest(
    requestId: string,
): Promise<LiffLeaveRequestDetail> {
    return unwrapLeaveResponse(
        await apiGet<LiffLeaveRequestDetail>(
            API_ROUTES.line.leaveRequestById(requestId),
            LIFF_API_REQUEST_OPTIONS,
        ),
    );
}

export async function submitLiffLeaveRequest(
    payload: LeaveRequestValues,
    attachments: readonly File[],
    idempotencyKey: string,
): Promise<void> {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    for (const attachment of attachments) {
        formData.append("attachments", attachment);
    }
    await unwrapLeaveResponse(
        await apiPost<unknown>(
            API_ROUTES.line.leaveRequest,
            formData,
            {
                ...LIFF_API_REQUEST_OPTIONS,
                headers: { "Idempotency-Key": idempotencyKey },
            },
        ),
    );
}

async function postLeaveMutation(
    route: string,
    payload: Record<string, unknown>,
): Promise<void> {
    await unwrapLeaveResponse(
        await apiPost<unknown>(route, payload, LIFF_API_REQUEST_OPTIONS),
    );
}

async function putLeaveMutation(
    route: string,
    payload: Record<string, unknown>,
): Promise<void> {
    await unwrapLeaveResponse(
        await apiPut<unknown>(route, payload, LIFF_API_REQUEST_OPTIONS),
    );
}

export async function cancelLiffLeave(
    leaveId: string,
    reason?: string,
): Promise<void> {
    return postLeaveMutation(API_ROUTES.line.leaveCancel, { leaveId, reason });
}

export async function requestLiffLeaveNotTaken(
    leaveId: string,
    note: string,
): Promise<void> {
    return postLeaveMutation(API_ROUTES.line.leaveNotTaken, { leaveId, note });
}

export async function submitLiffLeaveDecision(input: {
    leaveId: string;
    action: "APPROVE" | "REJECT";
    reason?: string;
}): Promise<void> {
    return postLeaveMutation(API_ROUTES.line.leaveDecision, input);
}

export async function confirmLiffLeaveNotTaken(
    leaveId: string,
    reason?: string,
): Promise<void> {
    return putLeaveMutation(API_ROUTES.line.leaveNotTaken, { leaveId, reason });
}

export async function decideLiffLeaveCancellation(input: {
    leaveId: string;
    action: "CONFIRM" | "REJECT";
    reason?: string;
}): Promise<void> {
    return putLeaveMutation(API_ROUTES.line.leaveCancel, input);
}

export async function fetchLiffLeaveAttachment(
    attachmentId: string,
    signal?: AbortSignal,
): Promise<Blob> {
    const response = await fetchLiffWithSessionRecovery(
        API_ROUTES.line.leaveAttachmentById(attachmentId),
        {
            cache: "no-store",
            credentials: "include",
            ...(signal ? { signal } : {}),
        },
    );
    if (!response.ok) {
        throw new LiffApiError(
            response.status === 401
                ? "การยืนยันตัวตนหมดอายุ กรุณาเปิด NHFapp จาก LINE อีกครั้ง"
                : "ไม่สามารถเปิดไฟล์แนบนี้ได้",
            response.status,
        );
    }
    const blob = await response.blob();
    if (blob.type !== "image/webp") {
        throw new LiffApiError("ชนิดไฟล์แนบไม่ถูกต้อง", response.status);
    }
    return blob;
}

export type {
    LiffEmployeeLeaveRequest,
    LiffLeaveApprovalItem,
    LiffLeaveApprovalsResponse,
    LiffLeaveProfileResponse,
    LiffLeaveRequestDetail,
    LiffLeaveQuotaSummary,
} from "@/lib/types/leave";
