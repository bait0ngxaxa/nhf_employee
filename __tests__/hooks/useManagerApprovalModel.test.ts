import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManagerApprovalModel } from "@/hooks/leave/useManagerApprovalModel";
import { useLeaveApprovals } from "@/hooks/useLeaveApprovals";
import {
    fetchLeaveExportRows,
    fetchLeaveExportYears,
    logLeaveExportAudit,
    submitLeaveApprovalAction,
} from "@/lib/services/leave/client";
import { toast } from "sonner";

vi.mock("@/hooks/useLeaveApprovals", () => ({
    useLeaveApprovals: vi.fn(),
}));

vi.mock("@/lib/services/leave/client", () => ({
    fetchLeaveExportRows: vi.fn(),
    fetchLeaveExportYears: vi.fn(),
    logLeaveExportAudit: vi.fn(),
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

        vi.mocked(fetchLeaveExportYears).mockResolvedValue({ years: [2030, 2029] });
        vi.mocked(fetchLeaveExportRows).mockResolvedValue([{ col: "value" }]);
        vi.mocked(submitLeaveApprovalAction).mockResolvedValue(undefined);
        vi.mocked(logLeaveExportAudit).mockResolvedValue(undefined);
    });

    it("loads available years and sets initial export year", async () => {
        const { result } = renderHook(() => useManagerApprovalModel());

        await waitFor(() => {
            expect(result.current.availableYears).toEqual([2030, 2029]);
            expect(result.current.exportYear).toBe(2030);
        });
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

    it("exports csv and writes audit log", async () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useManagerApprovalModel());
        act(() => {
            result.current.setExportYear(2030);
        });

        const click = vi.fn();
        const csvRef = {
            link: { click },
        } as unknown as { link: { click: () => void } };

        act(() => {
            (result.current.csvLinkRef as { current: unknown }).current = csvRef;
        });

        await act(async () => {
            await result.current.exportCsv();
        });

        act(() => {
            vi.advanceTimersByTime(100);
        });

        expect(fetchLeaveExportRows).toHaveBeenCalledWith(result.current.exportYear);
        expect(logLeaveExportAudit).toHaveBeenCalledWith(result.current.exportYear, 1);
        expect(click).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });
});
