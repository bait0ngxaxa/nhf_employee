import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useEmployeeLeaveDashboardModel } from "@/hooks/leave/useEmployeeLeaveDashboardModel";
import { useLeaveProfile } from "@/hooks/useLeaveProfile";

vi.mock("@/hooks/useLeaveProfile", () => ({
    useLeaveProfile: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("useEmployeeLeaveDashboardModel", () => {
    const mutate = vi.fn();
    const cancelLeave = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useLeaveProfile).mockReturnValue({
            quotas: [
                { leaveType: "SICK", totalDays: 10, usedDays: 2 },
                { leaveType: "PERSONAL", totalDays: 7, usedDays: 1 },
                { leaveType: "VACATION", totalDays: 6, usedDays: 0 },
            ] as unknown as ReturnType<typeof useLeaveProfile>["quotas"],
            history: [],
            metadata: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10 },
            isLoading: false,
            error: null,
            mutate,
            cancelLeave,
        });
    });

    it("opens and closes request form", () => {
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel());

        expect(result.current.isRequestFormOpen).toBe(false);
        act(() => result.current.openRequestForm());
        expect(result.current.isRequestFormOpen).toBe(true);
        act(() => result.current.closeRequestForm());
        expect(result.current.isRequestFormOpen).toBe(false);
    });

    it("closes request form after successful submit callback", async () => {
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel());

        act(() => result.current.openRequestForm());
        await act(async () => {
            await result.current.onRequestSuccess();
        });

        expect(mutate).toHaveBeenCalledTimes(1);
        expect(result.current.isRequestFormOpen).toBe(false);
    });

    it("confirms cancel leave and resets dialog state", async () => {
        cancelLeave.mockResolvedValue(true);
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel());

        act(() => result.current.openCancelDialog("leave-2"));
        await act(async () => {
            await result.current.confirmCancelLeave();
        });

        expect(cancelLeave).toHaveBeenCalledWith("leave-2");
        expect(result.current.cancelConfirmId).toBeNull();
        expect(toast.success).toHaveBeenCalledTimes(1);
    });
});

