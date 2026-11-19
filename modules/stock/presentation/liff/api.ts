import { apiGet, apiPost, type ApiResponse } from "@/lib/client/api-client";
import {
    isRecoveredLiffUnauthorizedResponse,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LIFF_API_REQUEST_OPTIONS,
    unwrapLiffResponse,
} from "@/modules/line/client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type {
    LiffStockCatalogResponse,
    LiffStockCategory,
    LiffStockRequestDetail,
    LiffStockRequestsResponse,
    LiffStockVariantAvailability,
    LiffStockVariantAvailabilityResponse,
} from "../../contracts/liff";
import type { CreateRequestInput } from "../../schemas/stock";

const LIFF_STOCK_API_REQUEST_OPTIONS = {
    ...LIFF_API_REQUEST_OPTIONS,
    credentials: "include",
} as const;

function getStockApiErrorMessage(
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
            return "ไม่พบข้อมูลวัสดุที่เปิดดูได้";
        case 409:
            return response.errorThai && response.errorThai === response.error
                ? response.errorThai
                : "ข้อมูลวัสดุเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด";
        case 429:
            return "คุณทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
        case 400:
        case 422:
            return response.errorThai || "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
        default:
            if (response.status === undefined) {
                return response.code === "TIMEOUT"
                    ? "การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่"
                    : "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
            }
            return "บริการเบิกวัสดุไม่พร้อมใช้งานชั่วคราว กรุณาลองอีกครั้ง";
    }
}

async function unwrapStockResponse<T>(
    response: ApiResponse<T>,
    accessDenied: string,
): Promise<T> {
    return unwrapLiffResponse(response, (failure) => getStockApiErrorMessage(failure, accessDenied));
}

function appendListFilters(
    route: string,
    input: {
        page: number;
        limit?: number;
        search?: string;
        status?: string;
        categoryId?: number;
    },
): string {
    const params = new URLSearchParams({ page: String(input.page) });
    if (input.limit !== undefined) params.set("limit", String(input.limit));
    if (input.search?.trim()) params.set("search", input.search.trim());
    if (input.status) params.set("status", input.status);
    if (input.categoryId !== undefined) {
        params.set("categoryId", String(input.categoryId));
    }
    return `${route}?${params.toString()}`;
}

export async function fetchLiffStockItems(input: {
    page: number;
    limit?: number;
    search?: string;
    categoryId?: number;
}): Promise<LiffStockCatalogResponse> {
    return unwrapStockResponse(
        await apiGet<LiffStockCatalogResponse>(
            appendListFilters(API_ROUTES.line.stockItems, input),
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดรายการวัสดุไม่ได้",
    );
}

export async function fetchLiffStockCategories(): Promise<LiffStockCategory[]> {
    const response = await unwrapStockResponse<{ categories: LiffStockCategory[] }>(
        await apiGet<{ categories: LiffStockCategory[] }>(
            API_ROUTES.line.stockCategories,
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดหมวดหมู่วัสดุไม่ได้",
    );
    return response.categories;
}

export async function fetchLiffStockVariantAvailability(
    variantIds: ReadonlyArray<number>,
): Promise<LiffStockVariantAvailability[]> {
    const uniqueVariantIds = Array.from(new Set(variantIds));
    const params = new URLSearchParams({
        variantIds: uniqueVariantIds.join(","),
    });
    const response = await unwrapStockResponse<LiffStockVariantAvailabilityResponse>(
        await apiGet<LiffStockVariantAvailabilityResponse>(
            `${API_ROUTES.line.stockAvailability}?${params.toString()}`,
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้ดูจำนวนวัสดุที่พร้อมเบิกไม่ได้",
    );
    return response.variants;
}

export async function submitLiffStockRequest(
    payload: CreateRequestInput,
    idempotencyKey: string,
): Promise<void> {
    await unwrapStockResponse(
        await apiPost<unknown>(API_ROUTES.line.stockRequests, payload, {
            ...LIFF_STOCK_API_REQUEST_OPTIONS,
            headers: { "Idempotency-Key": idempotencyKey },
        }),
        "บัญชีนี้ส่งคำขอเบิกวัสดุไม่ได้",
    );
}

export async function fetchLiffStockMyRequests(input: {
    page: number;
    limit?: number;
    search?: string;
    status?: string;
}): Promise<LiffStockRequestsResponse> {
    return unwrapStockResponse(
        await apiGet<LiffStockRequestsResponse>(
            appendListFilters(API_ROUTES.line.stockRequests, input),
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดรายการคำขอเบิกวัสดุไม่ได้",
    );
}

export async function fetchLiffStockRequest(
    requestId: number | string,
): Promise<LiffStockRequestDetail> {
    return unwrapStockResponse(
        await apiGet<LiffStockRequestDetail>(
            API_ROUTES.line.stockRequestById(requestId),
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดรายละเอียดคำขอเบิกไม่ได้",
    );
}

export async function cancelLiffStockRequest(
    requestId: number,
    cancelReason?: string,
): Promise<void> {
    await unwrapStockResponse(
        await apiPost<unknown>(
            API_ROUTES.line.stockCancelById(requestId),
            { cancelReason: cancelReason?.trim() || null },
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้ยกเลิกคำขอเบิกไม่ได้",
    );
}

export async function fetchLiffStockProcessingQueue(input: {
    page: number;
    limit?: number;
    search?: string;
}): Promise<LiffStockRequestsResponse> {
    return unwrapStockResponse(
        await apiGet<LiffStockRequestsResponse>(
            appendListFilters(API_ROUTES.line.stockProcessing, input),
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้เปิดรายการรอจ่ายวัสดุไม่ได้",
    );
}

export async function issueLiffStockRequest(requestId: number): Promise<void> {
    await unwrapStockResponse(
        await apiPost<unknown>(
            API_ROUTES.line.stockIssueById(requestId),
            {},
            LIFF_STOCK_API_REQUEST_OPTIONS,
        ),
        "บัญชีนี้จ่ายวัสดุสำหรับคำขอไม่ได้",
    );
}

export const rejectLiffStockRequest = cancelLiffStockRequest;

export type {
    LiffStockCatalogItem,
    LiffStockCatalogResponse,
    LiffStockCatalogVariant,
    LiffStockCategory,
    LiffStockRequestAction,
    LiffStockRequestDetail,
    LiffStockRequestsResponse,
    LiffStockRequestSummary,
    LiffStockVariantAvailability,
    LiffStockVariantAvailabilityResponse,
} from "../../contracts/liff";
