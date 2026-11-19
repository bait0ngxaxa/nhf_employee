import { apiGet, type ApiResponse } from "@/lib/client/api-client";
import {
    LIFF_API_REQUEST_OPTIONS,
    unwrapLiffResponse,
} from "./liff-client";
import type { LiffHomeResponse } from "../application/types";
import { API_ROUTES } from "@/lib/ssot/routes";

function getLiffHomeApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
): string {
    switch (response.status) {
        case 401:
            return "กรุณาเปิด NHFapp จาก LINE อีกครั้งเพื่อเข้าสู่ระบบ";
        case 403:
            return "บัญชี NHFapp นี้ยังไม่สามารถใช้บริการผ่าน LINE ได้ กรุณาติดต่อผู้ดูแลระบบ";
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
