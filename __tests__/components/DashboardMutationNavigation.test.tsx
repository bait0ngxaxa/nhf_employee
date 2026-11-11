import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowDashboardNavigation } from "@/lib/ui/dashboard-navigation-guard";
import { ApproverManagement } from "@/modules/leave/presentation/dashboard/ApproverManagement";
import { AddEmployeeForm } from "@/modules/employee/presentation/dashboard/add-employee/AddEmployeeForm";
import { EmailRequestProvider } from "@/modules/it/presentation/dashboard/email-request/EmailRequestProvider";
import { EmailRequestForm } from "@/modules/it/presentation/dashboard/email-request/EmailRequestForm";
import type { ApiResponse } from "@/lib/client/api-client";

const mocks = vi.hoisted(() => ({ save: vi.fn(), post: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/client/api-client", () => ({ apiPost: mocks.post, apiGet: vi.fn() }));
vi.mock("@/modules/leave/presentation/dashboard/api", () => ({ saveApproverAssignments: mocks.save, fetchApproverEmployees: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("swr", () => ({ default: (key: string | null) => ({ data: key === "leave-approver-employees" ? [
    { id: 1, firstName: "สมชาย", lastName: "ใจดี", nickname: null, email: "one@example.test", position: "Staff", managerId: null, canApproveLeave: false, dept: null },
    { id: 2, firstName: "ผู้อนุมัติ", lastName: "ทดสอบ", nickname: null, email: "two@example.test", position: "Lead", managerId: null, canApproveLeave: true, dept: null },
] : { departments: [{ id: 1, name: "IT", code: "IT" }], emailRequests: [] }, isLoading: false, error: null, mutate: mocks.mutate }) }));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void } {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

function fillFields(values: Readonly<Record<string, string>>): void {
    for (const [id, value] of Object.entries(values)) {
        const field = document.getElementById(id);
        if (!field) throw new Error(`Missing actual form field: ${id}`);
        fireEvent.change(field, { target: { value } });
    }
}

beforeEach(() => { Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true }); vi.clearAllMocks(); vi.spyOn(window, "alert").mockImplementation(() => {}); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"); });

describe("actual Dashboard form navigation protection", () => {
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

    it("blocks employee creation in flight and explains reconciliation after lost response", async () => {
        const request = deferred<ApiResponse<unknown>>();
        mocks.post.mockReturnValue(request.promise);
        render(<AddEmployeeForm canReadDepartments />);
        fillFields({ firstName: "สมชาย", lastName: "ใจดี", email: "employee@example.test", phone: "0812345678", position: "Staff" });
        fireEvent.keyDown(screen.getByRole("combobox", { name: "แผนก" }), { key: "ArrowDown" });
        fireEvent.click(await screen.findByRole("option", { name: "IT" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มพนักงาน" }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
        expect(allowDashboardNavigation()).toBe(false);
        await act(async () => request.resolve({ success: false, code: "NETWORK_ERROR", error: "connection lost", errorThai: "ขาดการเชื่อมต่อ" }));
        expect(allowDashboardNavigation()).toBe(false);
        expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining("รายชื่อพนักงานในแท็บใหม่"));
        expect(document.getElementById("email")).toHaveValue("employee@example.test");
    });

    it("retains the email-request retry key while pending or uncertain", async () => {
        const request = deferred<ApiResponse<unknown>>();
        mocks.post.mockReturnValueOnce(request.promise).mockResolvedValueOnce({ success: true, data: { success: true }, status: 200, requestId: "test" });
        render(<EmailRequestProvider capabilities={{ canReadRequests: false, canCreateRequests: true, canUpdateOwnRequests: false, canUpdateAllRequests: false }}><EmailRequestForm /></EmailRequestProvider>);
        fillFields({ thaiName: "สมชาย ใจดี", englishName: "Somchai Jaidee", nickname: "ชาย", phone: "0812345678", position: "Staff", department: "IT", replyEmail: "reply@example.test" });
        // Choose explicit decisions via the real controls.
        fireEvent.click(screen.getAllByRole("radio", { name: "ไม่ต้องใช้" })[0]);
        fireEvent.click(screen.getAllByRole("radio", { name: "ไม่ต้องใช้" })[1]);
        fireEvent.click(screen.getByRole("button", { name: /ส่งคำร้อง/ }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
        expect(allowDashboardNavigation()).toBe(false);
        await act(async () => request.resolve({ success: false, code: "NETWORK_ERROR", error: "connection lost", errorThai: "ขาดการเชื่อมต่อ" }));
        expect(allowDashboardNavigation()).toBe(false);
        expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining("ข้อมูลเดิม"));
        fireEvent.click(screen.getByRole("button", { name: /ส่งคำร้อง/ }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(allowDashboardNavigation()).toBe(true));
        expect(mocks.post.mock.calls[0][2]).toEqual(mocks.post.mock.calls[1][2]);
    });
});
