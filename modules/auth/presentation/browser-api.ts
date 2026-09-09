import { AUTH_MUTATION_HEADERS } from "@/lib/auth/mutation-headers";
import {
    fetchWithRefresh,
    isHybridReplayableMethod,
} from "./browser-transport";

type AuthApiErrorCode =
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "INTERNAL_ERROR"
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "UNKNOWN_ERROR";

export type AuthApiResponse<T> =
    | { success: true; data: T; status: number; requestId: string }
    | {
        success: false;
        error: string;
        errorThai: string;
        code: AuthApiErrorCode;
        status?: number;
        details?: unknown;
        requestId?: string;
    };

interface AuthApiRequestConfig extends Omit<RequestInit, "body" | "method"> {
    method?: string;
    data?: unknown;
    skipAuthRefresh?: boolean;
}

const DEFAULT_TIMEOUT_MS = 15000;
const SAFE_READ_RETRY_COUNT = 1;
const BASE_RETRY_DELAY_MS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function createRequestId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapStatusToCode(status: number): AuthApiErrorCode {
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 400 || status === 422) return "VALIDATION_ERROR";
    if (status >= 500) return "INTERNAL_ERROR";
    return "UNKNOWN_ERROR";
}

function thaiMessageForCode(code: AuthApiErrorCode): string {
    switch (code) {
        case "UNAUTHORIZED":
            return "ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่";
        case "FORBIDDEN":
            return "คุณไม่มีสิทธิ์ดำเนินการนี้";
        case "VALIDATION_ERROR":
            return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
        case "TIMEOUT":
            return "คำขอใช้เวลานานเกินไป กรุณาลองใหม่";
        case "NETWORK_ERROR":
            return "ไม่สามารถเชื่อมต่อเครือข่ายได้";
        case "INTERNAL_ERROR":
            return "ระบบขัดข้องชั่วคราว กรุณาลองใหม่";
        default:
            return "เกิดข้อผิดพลาดในการเชื่อมต่อ";
    }
}

function resolveThaiMessage(code: AuthApiErrorCode, message: string): string {
    return /[ก-๿]/.test(message) ? message : thaiMessageForCode(code);
}

function extractErrorMessage(value: unknown, fallback: string): string {
    if (isRecord(value)) {
        if (typeof value.error === "string" && value.error.length > 0) {
            return value.error;
        }
        if (typeof value.message === "string" && value.message.length > 0) {
            return value.message;
        }
    }
    return fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type");
    return contentType?.includes("application/json")
        ? response.json()
        : response.text();
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

export async function authApiRequest<T>(
    endpoint: string,
    config: AuthApiRequestConfig = {},
): Promise<AuthApiResponse<T>> {
    const {
        data,
        headers,
        method: configuredMethod,
        signal: inputSignal,
        skipAuthRefresh,
        ...requestConfig
    } = config;
    const method = configuredMethod?.toUpperCase() ?? "GET";
    const requestId = createRequestId();
    const requestHeaders = new Headers(headers);
    requestHeaders.set("X-Request-Id", requestId);
    if (data !== undefined && !requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
    }
    if (method !== "GET" && method !== "HEAD" && !requestHeaders.has("X-Requested-With")) {
        requestHeaders.set("X-Requested-With", AUTH_MUTATION_HEADERS["X-Requested-With"]);
    }

    const requestInit: RequestInit = {
        ...requestConfig,
        method,
        credentials: requestConfig.credentials ?? "include",
        headers: requestHeaders,
        body: data === undefined ? undefined : JSON.stringify(data),
    };

    for (let attempt = 0; attempt <= SAFE_READ_RETRY_COUNT; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            DEFAULT_TIMEOUT_MS,
        );
        const abortInput = (): void => controller.abort();
        if (inputSignal?.aborted) {
            controller.abort(inputSignal.reason);
        } else {
            inputSignal?.addEventListener("abort", abortInput, { once: true });
        }

        try {
            const response = await fetchWithRefresh(
                endpoint,
                { ...requestInit, signal: controller.signal },
                { refreshOnUnauthorized: !skipAuthRefresh },
            );
            if (
                isHybridReplayableMethod(method)
                && attempt < SAFE_READ_RETRY_COUNT
                && (response.status === 429 || response.status >= 500)
            ) {
                await delay(BASE_RETRY_DELAY_MS * 2 ** attempt);
                continue;
            }

            const responseData = await parseResponse(response);
            if (!response.ok) {
                const code = mapStatusToCode(response.status);
                const error = extractErrorMessage(
                    responseData,
                    response.statusText || "Request failed",
                );
                return {
                    success: false,
                    error,
                    errorThai: resolveThaiMessage(code, error),
                    code,
                    status: response.status,
                    details: responseData,
                    requestId,
                };
            }

            return {
                success: true,
                data: responseData as T,
                status: response.status,
                requestId,
            };
        } catch (error) {
            if (
                isHybridReplayableMethod(method)
                && attempt < SAFE_READ_RETRY_COUNT
                && !isAbortError(error)
            ) {
                await delay(BASE_RETRY_DELAY_MS * 2 ** attempt);
                continue;
            }

            const code: AuthApiErrorCode = isAbortError(error)
                ? "TIMEOUT"
                : error instanceof Error
                  ? "NETWORK_ERROR"
                  : "UNKNOWN_ERROR";
            const message = isAbortError(error)
                ? "Request timed out"
                : error instanceof Error
                  ? error.message || "Network request failed"
                  : "Network request failed";
            return {
                success: false,
                error: message,
                errorThai: resolveThaiMessage(code, message),
                code,
                requestId,
            };
        } finally {
            clearTimeout(timeoutId);
            inputSignal?.removeEventListener("abort", abortInput);
        }
    }

    return {
        success: false,
        error: "Request failed after retry",
        errorThai: thaiMessageForCode("NETWORK_ERROR"),
        code: "NETWORK_ERROR",
        requestId,
    };
}

export function authApiGet<T>(
    endpoint: string,
    config?: Omit<AuthApiRequestConfig, "body" | "data" | "method">,
): Promise<AuthApiResponse<T>> {
    return authApiRequest<T>(endpoint, { ...config, method: "GET" });
}

export function authApiPost<T>(
    endpoint: string,
    data?: unknown,
    config?: Omit<AuthApiRequestConfig, "body" | "data" | "method">,
): Promise<AuthApiResponse<T>> {
    return authApiRequest<T>(endpoint, { ...config, method: "POST", data });
}
