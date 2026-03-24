/**
 * Standardized API Client for Next.js Frontend (Functional Style)
 *
 * Uses a discriminated union Result pattern (`ApiResponse<T>`) instead of throwing errors,
 * eliminating the need for boilerplate try/catch blocks in UI components.
 */

import {
    refreshHybridSession,
    shouldAttemptHybridRefresh,
} from "@/lib/client-auth";

export type ApiResponse<T> =
    | { success: true; data: T; status: number }
    | { success: false; error: string; status?: number; details?: unknown };

interface RequestConfig extends RequestInit {
    data?: unknown;
}

/**
 * Helper: Ensure appropriate headers are set
 */
const createHeaders = (headers?: HeadersInit, hasData?: boolean): Headers => {
    const reqHeaders = new Headers(headers);
    if (!reqHeaders.has("Content-Type") && hasData) {
        reqHeaders.set("Content-Type", "application/json");
    }
    return reqHeaders;
};

/**
 * Helper: Safely parse JSON or text response
 */
const parseResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return response.json();
    }
    return response.text();
};

/**
 * Core request function returning an ApiResponse Result
 */
export async function apiRequest<T>(
    endpoint: string,
    config: RequestConfig = {},
): Promise<ApiResponse<T>> {
    const { data, headers, ...customConfig } = config;
    const reqHeaders = createHeaders(headers, !!data);

    const configWithData: RequestInit = {
        ...customConfig,
        credentials: customConfig.credentials ?? "include",
        headers: reqHeaders,
    };

    if (data) {
        configWithData.body = JSON.stringify(data);
    }

    try {
        let response = await fetch(endpoint, configWithData);
        if (response.status === 401 && shouldAttemptHybridRefresh(endpoint)) {
            const refreshed = await refreshHybridSession();
            if (refreshed) {
                response = await fetch(endpoint, configWithData);
            }
        }
        const responseData = await parseResponse(response);

        if (!response.ok) {
            return {
                success: false,
                error:
                    typeof responseData === "object" && responseData !== null
                        ? responseData.error || responseData.message || response.statusText
                        : response.statusText || "เกิดข้อผิดพลาดในการเชื่อมต่อ",
                status: response.status,
                details: responseData,
            };
        }

        return {
            success: true,
            data: responseData as T,
            status: response.status,
        };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "เกิดข้อผิดพลาดในการเชื่อมต่อ",
        };
    }
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
