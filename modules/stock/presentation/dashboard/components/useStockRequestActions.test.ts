import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "@/lib/client/api-client";
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
});
