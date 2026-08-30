import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import { useLeaveApprovals } from "@/hooks/useLeaveApprovals";
import {
    confirmLeaveCancellation,
    confirmLeaveNotTaken,
    rejectLeaveCancellation,
    submitLeaveDecision,
} from "@/lib/services/leave/client";
import { toast } from "sonner";

vi.mock("@/hooks/useLeaveApprovals", () => ({
    useLeaveApprovals: vi.fn(),
}));

vi.mock("@/lib/services/leave/client", () => ({
    confirmLeaveCancellation: vi.fn(),
    confirmLeaveNotTaken: vi.fn(),
    rejectLeaveCancellation: vi.fn(),
    submitLeaveDecision: vi.fn(),
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
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        createdAt: "2030-01-01",
        attachments: [],
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
            cancellationPending: [],
            metadata: {
                pending: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 1,
                    itemsPerPage: 10,
                },
                notTakenPending: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 0,
                    itemsPerPage: 10,
                },
                history: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 0,
                    itemsPerPage: 10,
                    availableYears: [2030],
                },
                cancellationPending: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 0,
                    itemsPerPage: 10,
                },
            },
            isLoading: false,
            isError: null,
            mutate,
        });

        vi.mocked(submitLeaveDecision).mockResolvedValue(undefined);
        vi.mocked(confirmLeaveNotTaken).mockResolvedValue(undefined);
        vi.mocked(confirmLeaveCancellation).mockResolvedValue(undefined);
        vi.mocked(rejectLeaveCancellation).mockResolvedValue(undefined);
    });

    it("approves leave and refreshes list", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        await act(async () => {
            await result.current.approveLeave(pendingLeave);
        });

        expect(submitLeaveDecision).toHaveBeenCalledWith({
            leaveId: "leave-1",
            action: "APPROVE",
            reason: undefined,
        });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("loads approval lists with first page pagination", () => {
        renderHook(() => useManagerApprovalModel());

        expect(useLeaveApprovals).toHaveBeenCalledWith({
            pendingPage: 1,
            notTakenPage: 1,
            historyPage: 1,
            cancellationPage: 1,
            historyFilters: {},
        });
    });

    it("resets only history pagination when a history filter changes", () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        act(() => {
            result.current.setPendingPage(2);
            result.current.setNotTakenPage(3);
            result.current.setHistoryPage(4);
            result.current.setCancellationPage(5);
            result.current.setHistoryStatus("APPROVED");
        });

        expect(result.current.historyStatus).toBe("APPROVED");
        expect(vi.mocked(useLeaveApprovals).mock.calls.at(-1)?.[0]).toEqual({
            pendingPage: 2,
            notTakenPage: 3,
            historyPage: 1,
            cancellationPage: 5,
            historyFilters: { status: "APPROVED" },
        });
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
        expect(submitLeaveDecision).not.toHaveBeenCalled();
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

    it("rejects a cancellation request and refreshes the approval lists", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        await act(async () => {
            await result.current.rejectCancellation("leave-cancellation");
        });

        expect(rejectLeaveCancellation).toHaveBeenCalledWith({ leaveId: "leave-cancellation" });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledWith(
            "ปิดคำขอยกเลิกแล้ว คำขอลายังคงอนุมัติ",
        );
    });
});
