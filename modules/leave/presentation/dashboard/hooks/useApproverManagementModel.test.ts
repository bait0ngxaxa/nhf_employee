import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useSWR from "swr";
import { toast } from "sonner";
import { useApproverManagementModel } from "./useApproverManagementModel";
import { saveApproverAssignments } from "../api";

vi.mock("swr");

vi.mock("../api", () => ({
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

    function createEmployees(count: number) {
        return Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            firstName: `Employee ${index + 1}`,
            lastName: "Test",
            nickname: null,
            email: `employee-${index + 1}@example.com`,
            position: "Staff",
            canApproveLeave: true,
            managerId: index % 2 === 0 ? null : 2,
            dept: { name: "IT" },
        }));
    }

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

    it("searches and displays approvers by canonical nickname identity", () => {
        const { result } = renderHook(() => useApproverManagementModel());

        act(() => result.current.setSearch("Bee"));

        expect(result.current.filteredEmployees).toEqual([employees[1]]);
        expect(result.current.formatName(employees[1])).toBe("B Two (Bee)");
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

    it("clamps durable pagination when the dataset shrinks and keeps the clamp after growth", () => {
        let currentEmployees = createEmployees(75);
        vi.mocked(useSWR).mockImplementation(() => ({
            data: currentEmployees,
            error: null,
            isLoading: false,
            mutate,
        }) as never);

        const { result, rerender } = renderHook(() => useApproverManagementModel());

        act(() => result.current.setCurrentPage(3));
        expect(result.current.currentPage).toBe(3);

        currentEmployees = createEmployees(30);
        rerender();

        expect(result.current.currentPage).toBe(2);
        expect(result.current.pagedEmployees.map((employee) => employee.id)).toEqual([
            26,
            27,
            28,
            29,
            30,
        ]);

        currentEmployees = createEmployees(75);
        rerender();

        expect(result.current.currentPage).toBe(2);
        expect(result.current.pagedEmployees[0]?.id).toBe(26);
    });

    it("keeps search and approver filter transitions explicitly on page one", () => {
        const currentEmployees = createEmployees(75);
        vi.mocked(useSWR).mockImplementation(() => ({
            data: currentEmployees,
            error: null,
            isLoading: false,
            mutate,
        }) as never);

        const { result } = renderHook(() => useApproverManagementModel());

        act(() => result.current.setCurrentPage(3));
        act(() => result.current.setSearch("Employee 7"));
        expect(result.current.currentPage).toBe(1);

        act(() => result.current.setSearch(""));
        act(() => result.current.setCurrentPage(3));
        act(() => result.current.setFilterApprover("unassigned"));
        expect(result.current.currentPage).toBe(1);
    });

    it("clamps after a save refresh shrinks the dataset without restoring the old page", async () => {
        let currentEmployees = createEmployees(75);
        const refreshMutate = vi.fn(async () => {
            currentEmployees = createEmployees(30);
        });
        vi.mocked(useSWR).mockImplementation(() => ({
            data: currentEmployees,
            error: null,
            isLoading: false,
            mutate: refreshMutate,
        }) as never);

        const { result, rerender } = renderHook(() => useApproverManagementModel());

        act(() => {
            result.current.setCurrentPage(3);
            result.current.handleAssign(1, "2");
        });
        await act(async () => {
            await result.current.handleSave();
        });

        expect(refreshMutate).toHaveBeenCalledTimes(1);
        expect(result.current.currentPage).toBe(2);

        currentEmployees = createEmployees(75);
        rerender();
        expect(result.current.currentPage).toBe(2);
    });
});

