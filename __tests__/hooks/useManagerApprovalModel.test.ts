import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import { useLeaveApprovals } from "@/hooks/useLeaveApprovals";
import {
    confirmLeaveNotTaken,
    submitLeaveApprovalAction,
} from "@/lib/services/leave/client";
import { toast } from "sonner";

vi.mock("@/hooks/useLeaveApprovals", () => ({
    useLeaveApprovals: vi.fn(),
}));

vi.mock("@/lib/services/leave/client", () => ({
    confirmLeaveNotTaken: vi.fn(),
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
    const pendingLeave = {
        id: "leave-1",
        employeeId: 1,
        leaveType: "SICK" as const,
        startDate: "2030-01-01",
        endDate: "2030-01-01",
        period: "FULL_DAY" as const,
        durationDays: 1,
        reason: "test",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "PENDING" as const,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        createdAt: "2030-01-01",
        employee: {
            firstName: "A",
            lastName: "B",
            nickname: null,
            position: "Dev",
            departmentId: 1,
            dept: { name: "IT" },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();

        vi.mocked(useLeaveApprovals).mockReturnValue({
            pending: [pendingLeave],
            notTakenPending: [],
            history: [],
            isLoading: false,
            isError: null,
            mutate,
        });

        vi.mocked(submitLeaveApprovalAction).mockResolvedValue(undefined);
        vi.mocked(confirmLeaveNotTaken).mockResolvedValue(undefined);
    });

    it("approves leave and refreshes list", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        await act(async () => {
            await result.current.approveLeave(pendingLeave);
        });

        expect(submitLeaveApprovalAction).toHaveBeenCalledWith({
            leaveId: "leave-1",
            action: "APPROVE",
            reason: undefined,
        });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("opens confirmation for special leave before approving", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());
        const specialLeave = {
            ...pendingLeave,
            specialReason: "จำเป็นต้องใช้สิทธิ์เพิ่ม",
            overQuotaDays: 1,
        };

        await act(async () => {
            await result.current.approveLeave(specialLeave);
        });

        expect(result.current.approvalConfirmLeave?.id).toBe("leave-1");
        expect(submitLeaveApprovalAction).not.toHaveBeenCalled();
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
