import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useSWR from "swr";
import { toast } from "sonner";
import { useApproverManagementModel } from "@/hooks/leave/useApproverManagementModel";
import { saveApproverAssignments } from "@/lib/services/leave/client";

vi.mock("swr");

vi.mock("@/lib/services/leave/client", () => ({
    saveApproverAssignments: vi.fn(),
    fetchApproverEmployees: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("useApproverManagementModel", () => {
    const mutate = vi.fn();

    const employees = [
        {
            id: 1,
            firstName: "A",
            lastName: "One",
            nickname: null,
            email: "a@example.com",
            position: "Dev",
            canApproveLeave: true,
            managerId: 2,
            dept: { name: "IT" },
        },
        {
            id: 2,
            firstName: "B",
            lastName: "Two",
            nickname: "Bee",
            email: "b@example.com",
            position: "Lead",
            canApproveLeave: true,
            managerId: null,
            dept: { name: "IT" },
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (useSWR as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
            data: employees,
            error: null,
            isLoading: false,
            mutate,
        });
        vi.mocked(saveApproverAssignments).mockResolvedValue({ message: "ok" });
    });

    it("computes approver stats from fetched employees", () => {
        const { result } = renderHook(() => useApproverManagementModel());

        expect(result.current.employees).toHaveLength(2);
        expect(result.current.activeApprovers).toHaveLength(1);
        expect(result.current.unassignedCount).toBe(1);
    });

    it("tracks assignment changes and saves successfully", async () => {
        const { result } = renderHook(() => useApproverManagementModel());

        act(() => {
            result.current.handleAssign(1, "");
        });

        expect(result.current.assignments.size).toBe(1);

        await act(async () => {
            await result.current.handleSave();
        });

        expect(saveApproverAssignments).toHaveBeenCalledWith({
            assignments: [{ employeeId: 1, managerId: null }],
        });
        expect(mutate).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(result.current.saveMsg?.type).toBe("ok");
        });
    });

    it("shows error message when save fails", async () => {
        vi.mocked(saveApproverAssignments).mockRejectedValue(new Error("save failed"));
        const { result } = renderHook(() => useApproverManagementModel());

        act(() => {
            result.current.handleAssign(1, "");
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(result.current.saveMsg?.type).toBe("err");
    });

    it("preserves unsaved assignments and shows the backend conflict message", async () => {
        const message = "พนักงานที่มีคำขอลารออนุมัติ: 10 (Employee Name) กรุณาให้พนักงานยกเลิกคำขอก่อนเปลี่ยนผู้อนุมัติ รายการทั้งหมดไม่ได้บันทึก";
        vi.mocked(saveApproverAssignments).mockRejectedValue(new Error(message));
        const { result } = renderHook(() => useApproverManagementModel());

        act(() => {
            result.current.handleAssign(1, "");
        });

        await act(async () => {
            await result.current.handleSave();
        });

        expect(result.current.saveMsg).toEqual({ type: "err", text: message });
        expect(toast.error).toHaveBeenCalledWith(message);
        expect(result.current.assignments).toEqual(new Map([[1, null]]));
        expect(mutate).not.toHaveBeenCalled();
    });
});

