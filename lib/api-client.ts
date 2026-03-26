/**
 * Standardized API Client for Next.js Frontend (Functional Style)
 *
 * Uses a discriminated union Result pattern (`ApiResponse<T>`) instead of throwing errors,
 * eliminating the need for boilerplate try/catch blocks in UI components.
 */

import { AUTH_MUTATION_HEADERS } from "@/lib/auth-csrf";
import { fetchWithRefresh } from "@/lib/client-auth";

export type ApiErrorCode =
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "VALIDATION_ERROR"
    | "INTERNAL_ERROR"
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "UNKNOWN_ERROR";

export type ApiResponse<T> =
    | { success: true; data: T; status: number; requestId: string }
    | {
          success: false;
          error: string;
          errorThai: string;
          code: ApiErrorCode;
          status?: number;
          details?: unknown;
          requestId?: string;
      };

interface RequestConfig extends RequestInit {
    data?: unknown;
    timeoutMs?: number;
    retryCount?: number;
    requestId?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_GET_RETRY_COUNT = 1;
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

function createHeaders(
    headers: HeadersInit | undefined,
    method: string | undefined,
    hasData: boolean,
    requestId: string,
): Headers {
    const reqHeaders = new Headers(headers);
    if (!reqHeaders.has("X-Request-Id")) {
        reqHeaders.set("X-Request-Id", requestId);
    }
    if (!reqHeaders.has("Content-Type") && hasData) {
        reqHeaders.set("Content-Type", "application/json");
    }

    const upperMethod = method?.toUpperCase();
    if (upperMethod && upperMethod !== "GET" && upperMethod !== "HEAD") {
        if (!reqHeaders.has("X-Requested-With")) {
            reqHeaders.set("X-Requested-With", AUTH_MUTATION_HEADERS["X-Requested-With"]);
        }
    }
    return reqHeaders;
}

async function parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
}

function mapStatusToCode(status: number): ApiErrorCode {
    if (status === 401) return "UNAUTHORIZED";
    if (status === 403) return "FORBIDDEN";
    if (status === 400 || status === 422) return "VALIDATION_ERROR";
    if (status >= 500) return "INTERNAL_ERROR";
    return "UNKNOWN_ERROR";
}

function getThaiErrorMessageByCode(code: ApiErrorCode): string {
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

function containsThai(text: string): boolean {
    return /[\u0E00-\u0E7F]/.test(text);
}

function resolveThaiErrorMessage(code: ApiErrorCode, rawMessage: string): string {
    if (containsThai(rawMessage)) {
        return rawMessage;
    }
    return getThaiErrorMessageByCode(code);
}

function extractErrorMessage(responseData: unknown, fallback: string): string {
    if (isRecord(responseData)) {
        const errorValue = responseData.error;
        const messageValue = responseData.message;
        if (typeof errorValue === "string" && errorValue.length > 0) {
            return errorValue;
        }
        if (typeof messageValue === "string" && messageValue.length > 0) {
            return messageValue;
        }
    }
    return fallback;
}

function shouldRetry(method: string, attempt: number, retryCount: number): boolean {
    return method === "GET" && attempt < retryCount;
}

function shouldRetryResponse(response: Response): boolean {
    return response.status === 429 || response.status >= 500;
}

function getRetryDelayMs(attempt: number): number {
    return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

function createTimedSignal(
    inputSignal: AbortSignal | null | undefined,
    timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort(new DOMException("Request timeout", "TimeoutError"));
    }, timeoutMs);

    const onInputAbort = (): void => {
        controller.abort(inputSignal?.reason);
    };

    if (inputSignal) {
        if (inputSignal.aborted) {
            controller.abort(inputSignal.reason);
        } else {
            inputSignal.addEventListener("abort", onInputAbort, { once: true });
        }
    }

    const cleanup = (): void => {
        clearTimeout(timeoutId);
        if (inputSignal) {
            inputSignal.removeEventListener("abort", onInputAbort);
        }
    };

    return { signal: controller.signal, cleanup };
}

function normalizeThrownError(error: unknown): { code: ApiErrorCode; message: string } {
    if (isAbortError(error)) {
        return { code: "TIMEOUT", message: "Request timed out" };
    }
    if (error instanceof Error) {
        return { code: "NETWORK_ERROR", message: error.message || "Network request failed" };
    }
    return { code: "UNKNOWN_ERROR", message: "Network request failed" };
}

/**
 * Core request function returning an ApiResponse Result
 */
export async function apiRequest<T>(
    endpoint: string,
    config: RequestConfig = {},
): Promise<ApiResponse<T>> {
    const { data, headers, timeoutMs, retryCount, requestId: customRequestId, ...customConfig } = config;
    const method = customConfig.method?.toUpperCase() ?? "GET";
    const requestId = customRequestId ?? createRequestId();
    const finalRetryCount = method === "GET" ? (retryCount ?? DEFAULT_GET_RETRY_COUNT) : 0;
    const finalTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const reqHeaders = createHeaders(headers, method, data !== undefined, requestId);

    const requestInit: RequestInit = {
        ...customConfig,
        method,
        credentials: customConfig.credentials ?? "include",
        headers: reqHeaders,
    };

    if (data !== undefined) {
        requestInit.body = JSON.stringify(data);
    }

    for (let attempt = 0; attempt <= finalRetryCount; attempt += 1) {
        const { signal, cleanup } = createTimedSignal(customConfig.signal, finalTimeoutMs);
        try {
            const response = await fetchWithRefresh(endpoint, {
                ...requestInit,
                signal,
            });

            if (shouldRetry(method, attempt, finalRetryCount) && shouldRetryResponse(response)) {
                await delay(getRetryDelayMs(attempt));
                continue;
            }

            const responseData = await parseResponse(response);
            if (!response.ok) {
                const code = mapStatusToCode(response.status);
                const errorMessage = extractErrorMessage(responseData, response.statusText || "Request failed");
                return {
                    success: false,
                    error: errorMessage,
                    errorThai: resolveThaiErrorMessage(code, errorMessage),
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
            if (shouldRetry(method, attempt, finalRetryCount) && !isAbortError(error)) {
                await delay(getRetryDelayMs(attempt));
                continue;
            }

            const normalized = normalizeThrownError(error);
            return {
                success: false,
                error: normalized.message,
                code: normalized.code,
                errorThai: resolveThaiErrorMessage(normalized.code, normalized.message),
                requestId,
            };
        } finally {
            cleanup();
        }
    }

    return {
        success: false,
        error: "Request failed after retry",
        code: "NETWORK_ERROR",
        errorThai: getThaiErrorMessageByCode("NETWORK_ERROR"),
        requestId,
    };
}

// ----------------------------------------------------------------------
// Convenience wrapper functions
// ----------------------------------------------------------------------

export const apiGet = <T>(
    endpoint: string,
    config?: Omit<RequestConfig, "body" | "data">,
): Promise<ApiResponse<T>> =>
    apiRequest<T>(endpoint, { ...config, method: "GET" });

export const apiPost = <T>(
    endpoint: string,
    data?: unknown,
    config?: Omit<RequestConfig, "body" | "data">,
): Promise<ApiResponse<T>> =>
    apiRequest<T>(endpoint, { ...config, method: "POST", data });

export const apiPut = <T>(
    endpoint: string,
    data?: unknown,
    config?: Omit<RequestConfig, "body" | "data">,
): Promise<ApiResponse<T>> =>
    apiRequest<T>(endpoint, { ...config, method: "PUT", data });

export const apiPatch = <T>(
    endpoint: string,
    data?: unknown,
    config?: Omit<RequestConfig, "body" | "data">,
): Promise<ApiResponse<T>> =>
    apiRequest<T>(endpoint, { ...config, method: "PATCH", data });

export const apiDelete = <T>(
    endpoint: string,
    config?: Omit<RequestConfig, "body" | "data">,
): Promise<ApiResponse<T>> =>
    apiRequest<T>(endpoint, { ...config, method: "DELETE" });
