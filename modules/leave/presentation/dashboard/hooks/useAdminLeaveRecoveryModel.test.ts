import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { useAdminLeaveRecoveryModel } from "./useAdminLeaveRecoveryModel";
import { useLeaveAdminRecovery } from "./useLeaveAdminRecovery";
import { confirmLeaveCancellation, confirmLeaveNotTaken, rejectLeaveCancellation } from "../api";

vi.mock("./useLeaveAdminRecovery", () => ({ useLeaveAdminRecovery: vi.fn() }));
vi.mock("../api", () => ({
    confirmLeaveCancellation: vi.fn(),
    confirmLeaveNotTaken: vi.fn(),
    rejectLeaveCancellation: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("admin Leave recovery", () => {
    const mutate = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(useLeaveAdminRecovery).mockReturnValue({
            notTakenPending: [], cancellationPending: [], isLoading: false, mutate,
        });
    });

    it.each([
        { action: "confirmNotTaken" as const, submit: confirmLeaveNotTaken },
        { action: "confirmCancellation" as const, submit: confirmLeaveCancellation },
        { action: "rejectCancellation" as const, submit: rejectLeaveCancellation },
    ])("$action sends the reason and refreshes the first recovery pages", async ({ action, submit }) => {
        const { result } = renderHook(() => useAdminLeaveRecoveryModel());
        act(() => {
            result.current.setNotTakenPage(3);
            result.current.setCancellationPage(4);
        });
        expect(useLeaveAdminRecovery).toHaveBeenLastCalledWith({ notTakenPage: 3, cancellationPage: 4 });

        await act(async () => {
            expect(await result.current[action]("leave-1", "verified recovery")).toBe(true);
        });

        expect(submit).toHaveBeenCalledExactlyOnceWith({ leaveId: "leave-1", reason: "verified recovery" });
        expect(mutate).toHaveBeenCalledOnce();
        expect(useLeaveAdminRecovery).toHaveBeenLastCalledWith({ notTakenPage: 1, cancellationPage: 1 });
        expect(result.current.isProcessing).toBe(false);
        expect(toast.success).toHaveBeenCalledOnce();
    });

    it("keeps recovery pages and reports a failed mutation without refreshing", async () => {
        vi.mocked(confirmLeaveNotTaken).mockRejectedValueOnce(new Error("recovery failed"));
        const { result } = renderHook(() => useAdminLeaveRecoveryModel());
        act(() => result.current.setNotTakenPage(3));

        await act(async () => {
            expect(await result.current.confirmNotTaken("leave-1", "verified recovery")).toBe(false);
        });

        expect(mutate).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("recovery failed");
        expect(result.current.isProcessing).toBe(false);
        expect(useLeaveAdminRecovery).toHaveBeenLastCalledWith({ notTakenPage: 3, cancellationPage: 1 });
    });
});
