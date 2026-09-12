import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { LeavePresentationCapabilities } from "../../../application/types";
import { useEmployeeLeaveDashboardModel } from "./useEmployeeLeaveDashboardModel";
import { useLeaveProfile } from "./useLeaveProfile";

vi.mock("./useLeaveProfile", () => ({
    useLeaveProfile: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("useEmployeeLeaveDashboardModel", () => {
    const LEAVE_CAPABILITIES: LeavePresentationCapabilities = {
        canReadOwnRequests: true,
        canReadAssignedApprovals: true,
        canCreateOwnRequests: true,
        canCancelOwnRequests: true,
        canApproveAssignedRequests: true,
        canDecideAssignedCancellations: true,
        canRequestOwnNotTaken: true,
        canConfirmAssignedNotTaken: true,
        canManageApprovers: false,
    };
    const mutate = vi.fn();
    const cancelLeave = vi.fn();
    const requestApprovedCancellation = vi.fn();
    const requestNotTaken = vi.fn();
    const pendingLeave = {
        id: "leave-2",
        employeeId: 10,
        leaveType: "SICK" as const,
        startDate: "2030-01-01T00:00:00.000Z",
        endDate: "2030-01-01T00:00:00.000Z",
        period: "FULL_DAY" as const,
        durationDays: 1,
        reason: "ลาป่วย",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        status: "PENDING" as const,
        approverId: 20,
        approvedAt: null,
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachments: [],
        createdAt: "2029-12-01T00:00:00.000Z",
        updatedAt: "2029-12-01T00:00:00.000Z",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useLeaveProfile).mockReturnValue({
            quotas: [
                {
                    leaveType: "SICK",
                    totalDays: 10,
                    carryBalanceDays: 0,
                    effectiveTotalDays: 10,
                    usedDays: 2,
                    remainingDays: 8,
                },
                {
                    leaveType: "PERSONAL",
                    totalDays: 10,
                    carryBalanceDays: -3,
                    effectiveTotalDays: 7,
                    usedDays: 1,
                    remainingDays: 6,
                },
                {
                    leaveType: "VACATION",
                    totalDays: 6,
                    carryBalanceDays: 0,
                    effectiveTotalDays: 6,
                    usedDays: 0,
                    remainingDays: 6,
                },
            ] as unknown as ReturnType<typeof useLeaveProfile>["quotas"],
            history: [
                {
                    ...pendingLeave,
                    id: "leave-3",
                    status: "APPROVED" as const,
                    endDate: "2020-01-01T00:00:00.000Z",
                },
            ],
            metadata: {
                currentPage: 1,
                totalPages: 1,
                totalItems: 0,
                itemsPerPage: 10,
                availableYears: [2030],
            },
            isLoading: false,
            error: null,
            mutate,
            cancelLeave,
            requestApprovedCancellation,
            requestNotTaken,
        });
    });

    it("opens and closes request form", () => {
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        expect(result.current.isRequestFormOpen).toBe(false);
        act(() => result.current.openRequestForm());
        expect(result.current.isRequestFormOpen).toBe(true);
        act(() => result.current.closeRequestForm());
        expect(result.current.isRequestFormOpen).toBe(false);
    });

    it("closes request form after successful submit callback", async () => {
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        act(() => result.current.openRequestForm());
        await act(async () => {
            await result.current.onRequestSuccess();
        });

        expect(mutate).toHaveBeenCalledTimes(1);
        expect(result.current.isRequestFormOpen).toBe(false);
    });

    it("resets employee history pagination when a filter changes", () => {
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        act(() => result.current.setPage(3));
        act(() => result.current.setHistoryLeaveType("SICK"));

        expect(result.current.page).toBe(1);
        expect(result.current.historyLeaveType).toBe("SICK");
        expect(vi.mocked(useLeaveProfile).mock.calls.at(-1)?.[0]).toEqual({
            page: 1,
            filters: { leaveType: "SICK" },
            enabled: true,
        });
    });

    it("resets all employee history filters and keeps the first page", () => {
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        act(() => {
            result.current.setPage(4);
            result.current.setHistoryQuery("ไข้");
            result.current.setHistoryStatus("APPROVED");
            result.current.setHistoryYear("2026");
        });
        act(() => result.current.resetHistoryFilters());

        expect(result.current.page).toBe(1);
        expect(result.current.historyQuery).toBe("");
        expect(result.current.historyLeaveType).toBe("");
        expect(result.current.historyStatus).toBe("");
        expect(result.current.historyYear).toBe("");
        expect(result.current.historyFilters).toEqual({});
    });

    it("debounces employee history text search before requesting filtered data", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        act(() => result.current.setHistoryQuery(" ไข้ "));
        expect(vi.mocked(useLeaveProfile).mock.calls.at(-1)?.[0]).toEqual({
            page: 1,
            filters: {},
            enabled: true,
        });

        act(() => vi.advanceTimersByTime(300));
        expect(vi.mocked(useLeaveProfile).mock.calls.at(-1)?.[0]).toEqual({
            page: 1,
            filters: { query: "ไข้" },
            enabled: true,
        });
        vi.useRealTimers();
    });

    it("confirms cancel leave and resets dialog state", async () => {
        cancelLeave.mockResolvedValue(true);
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        act(() => result.current.openCancelDialog(pendingLeave));
        await act(async () => {
            await result.current.confirmCancelLeave();
        });

        expect(cancelLeave).toHaveBeenCalledWith("leave-2");
        expect(result.current.cancelConfirmRequest).toBeNull();
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("submits not-taken request and resets dialog state", async () => {
        requestNotTaken.mockResolvedValue(true);
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(LEAVE_CAPABILITIES));

        act(() => {
            result.current.openNotTakenDialog("leave-3");
            result.current.setNotTakenNote("ไม่ได้ลาเพราะมีงานด่วน");
        });

        await act(async () => {
            await result.current.confirmNotTakenRequest();
        });

        expect(requestNotTaken).toHaveBeenCalledWith("leave-3", "ไม่ได้ลาเพราะมีงานด่วน");
        expect(result.current.notTakenRequestId).toBeNull();
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it("does not load or open self-service controls without the relevant capabilities", () => {
        const capabilities: LeavePresentationCapabilities = {
            ...LEAVE_CAPABILITIES,
            canReadOwnRequests: false,
            canCreateOwnRequests: false,
            canCancelOwnRequests: false,
            canRequestOwnNotTaken: false,
        };
        const { result } = renderHook(() => useEmployeeLeaveDashboardModel(capabilities));

        expect(vi.mocked(useLeaveProfile).mock.calls.at(-1)?.[0]).toEqual({
            page: 1,
            filters: {},
            enabled: false,
        });
        act(() => {
            result.current.openRequestForm();
            result.current.openCancelDialog(pendingLeave);
            result.current.openNotTakenDialog("leave-3");
        });

        expect(result.current.isRequestFormOpen).toBe(false);
        expect(result.current.cancelConfirmRequest).toBeNull();
        expect(result.current.notTakenRequestId).toBeNull();
    });

    it("closes open self-service controls when a refreshed projection removes capability", () => {
        const { result, rerender } = renderHook(
            ({ capabilities }: { capabilities: LeavePresentationCapabilities }) =>
                useEmployeeLeaveDashboardModel(capabilities),
            { initialProps: { capabilities: LEAVE_CAPABILITIES } },
        );

        act(() => {
            result.current.openRequestForm();
            result.current.openCancelDialog(pendingLeave);
            result.current.openNotTakenDialog("leave-3");
        });
        expect(result.current.isRequestFormOpen).toBe(true);
        expect(result.current.cancelConfirmRequest).not.toBeNull();
        expect(result.current.notTakenRequestId).toBe("leave-3");

        rerender({
            capabilities: {
                ...LEAVE_CAPABILITIES,
                canCreateOwnRequests: false,
                canCancelOwnRequests: false,
                canRequestOwnNotTaken: false,
            },
        });

        expect(result.current.isRequestFormOpen).toBe(false);
        expect(result.current.cancelConfirmRequest).toBeNull();
        expect(result.current.notTakenRequestId).toBeNull();
    });
});

