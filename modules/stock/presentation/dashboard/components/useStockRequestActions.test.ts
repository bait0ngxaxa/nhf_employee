import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "@/lib/client/api-client";
import type { ApiResponse } from "@/lib/client/api-client";
import { useStockRequestActions } from "./useStockRequestActions";

vi.mock("@/lib/client/api-client", () => ({
    apiPost: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

function success<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
        status: 200,
        requestId: "stock-request-action-test",
    };
}

function failure(): ApiResponse<never> {
    return {
        success: false,
        error: "Request conflict",
        errorThai: "คำขอนี้มีการเปลี่ยนแปลงแล้ว",
        code: "UNKNOWN_ERROR",
        status: 409,
    };
}

describe("useStockRequestActions capability guards", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not cancel when the global cancel capability is unavailable", async () => {
        const { result } = renderHook(() => useStockRequestActions({
            canCancelRequests: false,
            canProcessRequests: true,
        }));

        await act(async () => {
            await result.current.runCancelRequest(71, "ไม่ต้องการแล้ว");
        });

        expect(apiPost).not.toHaveBeenCalled();
        expect(result.current.processingRequestId).toBeNull();
    });

    it("does not issue when the global process capability is unavailable", async () => {
        const { result } = renderHook(() => useStockRequestActions({
            canCancelRequests: true,
            canProcessRequests: false,
        }));

        await act(async () => {
            await result.current.runIssueRequest(71);
        });

        expect(apiPost).not.toHaveBeenCalled();
        expect(result.current.processingRequestId).toBeNull();
    });

    it("issues a request only once while a confirmation is already in progress", async () => {
        let resolveResponse: ((response: ApiResponse<unknown>) => void) | undefined;
        vi.mocked(apiPost).mockReturnValueOnce(new Promise((resolve) => {
            resolveResponse = resolve;
        }));
        const { result } = renderHook(() => useStockRequestActions({
            canCancelRequests: true,
            canProcessRequests: true,
        }));

        let firstResult: Awaited<ReturnType<typeof result.current.runIssueRequest>> | undefined;
        let secondResult: Awaited<ReturnType<typeof result.current.runIssueRequest>> | undefined;
        await act(async () => {
            const first = result.current.runIssueRequest(71);
            const second = result.current.runIssueRequest(71);
            resolveResponse?.(success({}));
            [firstResult, secondResult] = await Promise.all([first, second]);
        });

        expect(apiPost).toHaveBeenCalledTimes(1);
        expect(apiPost).toHaveBeenCalledWith(expect.any(String), {});
        expect(firstResult).toEqual({ success: true });
        expect(secondResult).toMatchObject({ success: false });
        expect(result.current.processingRequestId).toBeNull();
    });

    it("returns a failed result and refreshes after a stale request response", async () => {
        const onIssueFailure = vi.fn();
        vi.mocked(apiPost).mockResolvedValueOnce(failure());
        const { result } = renderHook(() => useStockRequestActions({
            canCancelRequests: true,
            canProcessRequests: true,
            onIssueFailure,
        }));

        let issueResult: Awaited<ReturnType<typeof result.current.runIssueRequest>> | undefined;
        await act(async () => {
            issueResult = await result.current.runIssueRequest(71);
        });

        expect(issueResult).toEqual({
            success: false,
            message: "คำขอนี้มีการเปลี่ยนแปลงแล้ว",
            status: 409,
        });
        expect(onIssueFailure).toHaveBeenCalledTimes(1);
        expect(result.current.processingRequestId).toBeNull();
    });
});
