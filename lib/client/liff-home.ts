import { apiGet, type ApiResponse } from "@/lib/client/api-client";
import {
    LIFF_API_REQUEST_OPTIONS,
    unwrapLiffResponse,
} from "@/lib/client/liff";
import type { LiffHomeResponse } from "@/lib/line/liff-types";
import { API_ROUTES } from "@/lib/ssot/routes";

function getLiffHomeApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
): string {
    switch (response.status) {
        case 401:
            return "การยืนยันตัวตนหมดอายุ กรุณาลองใหม่อีกครั้ง";
        case 403:
            return "บัญชี NHFapp นี้ยังไม่สามารถใช้บริการผ่าน LINE ได้";
        default:
            return "ไม่สามารถโหลดบริการของคุณได้ กรุณาลองใหม่อีกครั้ง";
    }
}

export async function fetchLiffHome(): Promise<LiffHomeResponse> {
    return unwrapLiffResponse(
        await apiGet<LiffHomeResponse>(
            API_ROUTES.line.home,
            LIFF_API_REQUEST_OPTIONS,
        ),
        getLiffHomeApiErrorMessage,
    );
}
