import { apiPost, type ApiResponse } from "@/lib/client/api-client";
import type { LiffSessionResponse } from "@/lib/line/liff-types";
import { API_ROUTES } from "@/lib/ssot/routes";

export type { LiffSessionResponse, LiffWorkforceIdentity } from "@/lib/line/liff-types";

export class LiffApiError extends Error {
    readonly status: number | undefined;

    constructor(message: string, status: number | undefined) {
        super(message);
        this.name = "LiffApiError";
        this.status = status;
    }
}

function getSafeLiffApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
): string {
    switch (response.status) {
        case 401:
            return "การยืนยันตัวตนหมดอายุ กรุณาลองใหม่อีกครั้ง";
        case 403:
            return "บัญชี NHFapp นี้ยังไม่สามารถใช้บริการผ่าน LINE ได้";
        case 404:
            return "ไม่พบบริการ NHFapp ผ่าน LINE ที่ร้องขอ";
        case 409:
            return "บัญชี LINE หรือบัญชี NHFapp นี้ถูกเชื่อมกับบัญชีอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ";
        default:
            return response.errorThai
                || "ไม่สามารถเชื่อมต่อบริการ NHFapp ผ่าน LINE ได้";
    }
}

export async function unwrapLiffResponse<T>(
    response: ApiResponse<T>,
    getErrorMessage: (
        failure: Extract<ApiResponse<unknown>, { success: false }>,
    ) => string = getSafeLiffApiErrorMessage,
): Promise<T> {
    if (response.success) return response.data;
    throw new LiffApiError(getErrorMessage(response), response.status);
}

export const LIFF_API_REQUEST_OPTIONS = {
    retryCount: 0,
    skipAuthRefresh: true,
} as const;

export async function establishLiffSession(
    idToken: string,
): Promise<LiffSessionResponse> {
    return unwrapLiffResponse(
        await apiPost<LiffSessionResponse>(
            API_ROUTES.line.liffSession,
            { idToken },
            LIFF_API_REQUEST_OPTIONS,
        ),
    );
}

export async function linkLiffAccount(
    idToken: string,
): Promise<Extract<LiffSessionResponse, { linked: true }>> {
    return unwrapLiffResponse(
        await apiPost<Extract<LiffSessionResponse, { linked: true }>>(
            API_ROUTES.line.accountLink,
            { idToken },
            LIFF_API_REQUEST_OPTIONS,
        ),
    );
}
