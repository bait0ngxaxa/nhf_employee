import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowDashboardNavigation } from "@/lib/ui/dashboard-navigation-guard";
import { ApproverManagement } from "./ApproverManagement";

const mocks = vi.hoisted(() => ({ save: vi.fn(), mutate: vi.fn() }));
vi.mock("./api", () => ({ saveApproverAssignments: mocks.save, fetchApproverEmployees: vi.fn() }));
vi.mock("swr", () => ({ default: () => ({ data: [
    { id: 1, firstName: "สมชาย", lastName: "ใจดี", nickname: null, email: "one@example.test", position: "Staff", managerId: null, canApproveLeave: false, dept: null },
    { id: 2, firstName: "ผู้อนุมัติ", lastName: "ทดสอบ", nickname: null, email: "two@example.test", position: "Lead", managerId: null, canApproveLeave: true, dept: null },
], isLoading: false, error: null, mutate: mocks.mutate }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void } {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

beforeEach(() => { Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true }); vi.clearAllMocks(); vi.spyOn(window, "alert").mockImplementation(() => {}); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"); });

describe("actual form navigation protection", () => {
    it("keeps approver assignments mounted during save and unresolved retry", async () => {
        const first = deferred<{ message: string }>();
        mocks.save.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ message: "ok" });
        render(<ApproverManagement />);
        fireEvent.change(screen.getByRole("combobox", { name: "เลือกผู้อนุมัติสำหรับ สมชาย ใจดี" }), { target: { value: "2" } });
        expect(allowDashboardNavigation()).toBe(true); // explicit discard confirmation for an ordinary draft
        fireEvent.click(screen.getByRole("button", { name: "บันทึก (1)" }));
        expect(allowDashboardNavigation()).toBe(false);
        await act(async () => first.reject(new Error("connection lost")));
        expect(allowDashboardNavigation()).toBe(false);
        expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining("รายการเดิม"));
        expect(screen.getByRole("combobox", { name: "เลือกผู้อนุมัติสำหรับ สมชาย ใจดี" })).toHaveValue("2");
        fireEvent.click(screen.getByRole("button", { name: "บันทึก (1)" }));
        await waitFor(() => expect(screen.queryByRole("button", { name: "บันทึก (1)" })).not.toBeInTheDocument());
        expect(allowDashboardNavigation()).toBe(true);
        expect(mocks.save.mock.calls[0]).toEqual(mocks.save.mock.calls[1]);
    });


});
