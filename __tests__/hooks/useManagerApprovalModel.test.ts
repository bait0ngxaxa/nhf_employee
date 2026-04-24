import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import { useLeaveApprovals } from "@/hooks/useLeaveApprovals";
import {
    submitLeaveApprovalAction,
} from "@/lib/services/leave/client";
import { toast } from "sonner";

vi.mock("@/hooks/useLeaveApprovals", () => ({
    useLeaveApprovals: vi.fn(),
}));

vi.mock("@/lib/services/leave/client", () => ({
    submitLeaveApprovalAction: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("useManagerApprovalModel", () => {
    const mutate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();

        vi.mocked(useLeaveApprovals).mockReturnValue({
            pending: [
                {
                    id: "leave-1",
                    employeeId: 1,
                    leaveType: "SICK",
                    startDate: "2030-01-01",
                    endDate: "2030-01-01",
                    period: "FULL_DAY",
                    durationDays: 1,
                    reason: "test",
                    status: "PENDING",
                    createdAt: "2030-01-01",
                    employee: {
                        firstName: "A",
                        lastName: "B",
                        nickname: null,
                        position: "Dev",
                        departmentId: 1,
                        dept: { name: "IT" },
                    },
                },
            ],
            history: [],
            isLoading: false,
            isError: null,
            mutate,
        });

        vi.mocked(submitLeaveApprovalAction).mockResolvedValue(undefined);
    });

    it("approves leave and refreshes list", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        await act(async () => {
            await result.current.approveLeave("leave-1");
        });

        expect(submitLeaveApprovalAction).toHaveBeenCalledWith({
            leaveId: "leave-1",
            action: "APPROVE",
            reason: undefined,
        });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("opens reject dialog and clears state when closed", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        act(() => {
            result.current.openRejectDialog(result.current.pending[0]);
        });

        expect(result.current.isRejectDialogOpen).toBe(true);
        expect(result.current.selectedLeave?.id).toBe("leave-1");

        act(() => {
            result.current.setRejectReason("ไม่อนุมัติ");
            result.current.closeRejectDialog();
        });

        await waitFor(() => {
            expect(result.current.isRejectDialogOpen).toBe(false);
            expect(result.current.selectedLeave).toBeNull();
            expect(result.current.rejectReason).toBe("");
        });
    });
});
