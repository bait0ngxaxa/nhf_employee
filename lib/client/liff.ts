import {
    apiPost,
    type ApiResponse,
    type UnauthorizedRecoveryHandler,
} from "@/lib/client/api-client";
import type { LiffSessionResponse } from "@/lib/line/liff-types";
import { API_ROUTES } from "@/lib/ssot/routes";

export type { LiffSessionResponse, LiffWorkforceIdentity } from "@/lib/line/liff-types";

export class LiffApiError extends Error {
    readonly status: number | undefined;
    readonly details: unknown;

    constructor(
        message: string,
        status: number | undefined,
        details: unknown = undefined,
    ) {
        super(message);
        this.name = "LiffApiError";
        this.status = status;
        this.details = details;
    }
}

type LiffSessionRecoveryHandler = () => Promise<boolean>;
type LiffRebootstrapHandler = () => void;

let activeRecoveryHandler: LiffSessionRecoveryHandler | null = null;
let activeRebootstrapHandler: LiffRebootstrapHandler | null = null;
let recoveryInFlight: {
    handler: LiffSessionRecoveryHandler;
    promise: Promise<boolean>;
} | null = null;
let rebootstrapRequested = false;

export function registerLiffSessionRecovery(
    handler: LiffSessionRecoveryHandler,
    rebootstrap: LiffRebootstrapHandler,
): () => void {
    activeRecoveryHandler = handler;
    activeRebootstrapHandler = rebootstrap;
    rebootstrapRequested = false;

    return () => {
        if (activeRecoveryHandler !== handler) return;
        activeRecoveryHandler = null;
        activeRebootstrapHandler = null;
    };
}

export async function recoverLiffSession(): Promise<boolean> {
    const handler = activeRecoveryHandler;
    if (!handler) return false;

    if (recoveryInFlight?.handler === handler) {
        return recoveryInFlight.promise;
    }

    const promise = Promise.resolve()
        .then(() => handler())
        .catch(() => false)
        .finally(() => {
            if (recoveryInFlight?.promise === promise) {
                recoveryInFlight = null;
            }
        });
    recoveryInFlight = { handler, promise };
    return promise;
}

function requestLiffRebootstrap(): void {
    if (!activeRebootstrapHandler || rebootstrapRequested) return;
    rebootstrapRequested = true;
    try {
        activeRebootstrapHandler();
    } catch {
        // Keep the expired-session response visible if the host cannot reload.
    }
}

export const handleLiffUnauthorized: UnauthorizedRecoveryHandler = async ({
    method,
}) => {
    const recovered = await recoverLiffSession();
    if (!recovered) requestLiffRebootstrap();
    return recovered && method.toUpperCase() === "GET";
};

export async function fetchLiffWithSessionRecovery(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const method = init?.method?.toUpperCase() ?? "GET";
    let response = await fetch(input, init);
    if (response.status !== 401) return response;

    const shouldReplay = await handleLiffUnauthorized({
        endpoint: typeof input === "string" ? input : input.toString(),
        method,
        response,
    });
    if (shouldReplay && method === "GET" && !init?.signal?.aborted) {
        response = await fetch(input, init);
    }
    return response;
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
    throw new LiffApiError(
        getErrorMessage(response),
        response.status,
        response.details,
    );
}

const LIFF_SESSION_REQUEST_OPTIONS = {
    retryCount: 0,
    skipAuthRefresh: true,
} as const;

export const LIFF_API_REQUEST_OPTIONS = {
    ...LIFF_SESSION_REQUEST_OPTIONS,
    onUnauthorized: handleLiffUnauthorized,
} as const;

export async function establishLiffSession(
    idToken: string,
): Promise<LiffSessionResponse> {
    return unwrapLiffResponse(
        await apiPost<LiffSessionResponse>(
            API_ROUTES.line.liffSession,
            { idToken },
            LIFF_SESSION_REQUEST_OPTIONS,
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
            LIFF_SESSION_REQUEST_OPTIONS,
        ),
    );
}
