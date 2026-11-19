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
} from "@/modules/line/client";
import type { LeaveHistoryFilters } from "../../application/queries/history-filters";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { LiffLeaveApprovalsResponse, LiffLeaveProfileResponse, LiffLeaveRequestDetail } from "../types";
import type { LeaveRequestValues } from "../../schemas/leave";

function getLeaveApiErrorMessage(
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
            return "ไม่พบข้อมูลวันลาที่เปิดดูได้";
        case 409:
            return response.errorThai && response.errorThai === response.error
                ? response.errorThai
                : "สถานะคำขอลาเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่";
        case 413:
            return "ไฟล์แนบหรือคำขอมีขนาดใหญ่เกินไป";
        case 400:
        case 422:
            return response.errorThai || "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
        default:
            if (response.status === undefined) {
                return response.code === "TIMEOUT"
                    ? "การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่"
                    : "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
            }
            return "บริการวันลาไม่พร้อมใช้งานชั่วคราว กรุณาลองอีกครั้ง";
    }
}

async function unwrapLeaveResponse<T>(
    response: ApiResponse<T>,
    accessDenied: string,
): Promise<T> {
    return unwrapLiffResponse(response, (failure) => getLeaveApiErrorMessage(failure, accessDenied));
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
        "บัญชีนี้เปิดข้อมูลและประวัติวันลาไม่ได้",
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
        "บัญชีนี้เปิดรายการคำขอลาที่รอพิจารณาไม่ได้",
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
        "บัญชีนี้เปิดรายละเอียดคำขอลาไม่ได้",
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
        "บัญชีนี้ส่งคำขอลาไม่ได้",
    );
}

async function postLeaveMutation(
    route: string,
    payload: Record<string, unknown>,
    accessDenied: string,
): Promise<void> {
    await unwrapLeaveResponse(
        await apiPost<unknown>(route, payload, LIFF_API_REQUEST_OPTIONS),
        accessDenied,
    );
}

async function putLeaveMutation(
    route: string,
    payload: Record<string, unknown>,
    accessDenied: string,
): Promise<void> {
    await unwrapLeaveResponse(
        await apiPut<unknown>(route, payload, LIFF_API_REQUEST_OPTIONS),
        accessDenied,
    );
}

export async function cancelLiffLeave(
    leaveId: string,
    reason?: string,
): Promise<void> {
    return postLeaveMutation(
        API_ROUTES.line.leaveCancel,
        { leaveId, reason },
        "บัญชีนี้ยกเลิกคำขอลาไม่ได้",
    );
}

export async function requestLiffLeaveNotTaken(
    leaveId: string,
    note: string,
): Promise<void> {
    return postLeaveMutation(
        API_ROUTES.line.leaveNotTaken,
        { leaveId, note },
        "บัญชีนี้ส่งคำขอแจ้งไม่ได้ใช้วันลาไม่ได้",
    );
}

export async function submitLiffLeaveDecision(input: {
    leaveId: string;
    expectedSpecialReason?: string | null;
    action: "APPROVE" | "REJECT";
    reason?: string;
}): Promise<void> {
    return postLeaveMutation(
        API_ROUTES.line.leaveDecision,
        input,
        "บัญชีนี้พิจารณาคำขอลาไม่ได้",
    );
}

export async function confirmLiffLeaveNotTaken(
    leaveId: string,
    reason?: string,
): Promise<void> {
    return putLeaveMutation(
        API_ROUTES.line.leaveNotTaken,
        { leaveId, reason },
        "บัญชีนี้ยืนยันการไม่ได้ใช้วันลาไม่ได้",
    );
}

export async function decideLiffLeaveCancellation(input: {
    leaveId: string;
    action: "CONFIRM" | "REJECT";
    reason?: string;
}): Promise<void> {
    return putLeaveMutation(
        API_ROUTES.line.leaveCancel,
        input,
        "บัญชีนี้พิจารณาคำขอยกเลิกวันลาไม่ได้",
    );
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
                ? "กรุณาเปิด NHFapp จาก LINE อีกครั้งเพื่อเข้าสู่ระบบ"
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
} from "../types";
