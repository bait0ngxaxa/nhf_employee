import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowDashboardNavigation } from "@/lib/ui/dashboard-navigation-guard";
import type { ApiResponse } from "@/lib/client/api-client";
import { AddEmployeeForm } from "./AddEmployeeForm";

const mocks = vi.hoisted(() => ({ post: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/client/api-client", () => ({ apiPost: mocks.post, apiGet: vi.fn() }));
vi.mock("swr", () => ({ default: () => ({ data: { departments: [{ id: 1, name: "IT", code: "IT" }] }, isLoading: false, error: null, mutate: mocks.mutate }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

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

describe("actual form navigation protection", () => {
    it("preserves uncertain employee data, prevents duplicate submission, and requires explicit recovery acknowledgement", async () => {
        const request = deferred<ApiResponse<unknown>>();
        mocks.post.mockReturnValue(request.promise);
        render(<AddEmployeeForm canReadDepartments canReadEmployees={false} />);
        fillFields({ firstName: "สมชาย", lastName: "ใจดี", email: "employee@example.test", phone: "0812345678", position: "Staff" });
        fireEvent.keyDown(screen.getByRole("combobox", { name: "แผนก" }), { key: "ArrowDown" });
        fireEvent.click(await screen.findByRole("option", { name: "IT" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มพนักงาน" }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
        expect(allowDashboardNavigation()).toBe(false);
        await act(async () => request.resolve({ success: false, code: "NETWORK_ERROR", error: "connection lost", errorThai: "ขาดการเชื่อมต่อ" }));
        expect(allowDashboardNavigation()).toBe(false);
        expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining("สิทธิ์ที่ได้รับ"));
        expect(screen.getByRole("heading", { name: "ผลการเพิ่มพนักงานยังไม่ชัดเจน" })).toBeInTheDocument();
        expect(screen.getByText(/ติดต่อผู้ดูแลระบบ/)).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "ตรวจสอบรายชื่อพนักงานในแท็บใหม่" })).not.toBeInTheDocument();
        const email = document.getElementById("email");
        if (!(email instanceof HTMLInputElement)) throw new Error("Missing actual employee email field");
        expect(email).toHaveValue("employee@example.test");
        expect(email).toBeDisabled();
        fireEvent.change(email, { target: { value: "edited@example.test" } });
        expect(email).toHaveValue("employee@example.test");
        expect(screen.getByRole("button", { name: "เพิ่มพนักงาน" })).toBeDisabled();
        const form = document.querySelector("form");
        if (!(form instanceof HTMLFormElement)) throw new Error("Missing actual employee form");
        fireEvent.submit(form);
        expect(mocks.post).toHaveBeenCalledOnce();

        fireEvent.click(screen.getByRole("button", { name: "รับทราบผลที่ยังไม่ยืนยัน" }));
        expect(document.querySelector('[data-navigation-unresolved="true"]')).not.toBeInTheDocument();
        expect(email).toHaveValue("employee@example.test");
        expect(email).toBeDisabled();
        expect(screen.getByRole("button", { name: "เพิ่มพนักงาน" })).toBeDisabled();
        expect(screen.getByRole("link", { name: "ออกจากแบบฟอร์มโดยไม่ส่งซ้ำ" })).toHaveAttribute("href", "/dashboard");
        expect(allowDashboardNavigation()).toBe(true);
        expect(window.confirm).toHaveBeenCalled();
    });

    it("offers the employee list for reconciliation only when list access is explicitly granted", async () => {
        mocks.post.mockRejectedValueOnce(new TypeError("connection lost"));
        render(<AddEmployeeForm canReadDepartments canReadEmployees />);
        fillFields({ firstName: "สมชาย", lastName: "ใจดี", email: "employee@example.test", phone: "0812345678", position: "Staff" });
        fireEvent.keyDown(screen.getByRole("combobox", { name: "แผนก" }), { key: "ArrowDown" });
        fireEvent.click(await screen.findByRole("option", { name: "IT" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มพนักงาน" }));

        const listLink = await screen.findByRole("link", { name: "ตรวจสอบรายชื่อพนักงานในแท็บใหม่" });
        expect(listLink).toHaveAttribute("href", "/dashboard/employees");
        expect(listLink).toHaveAttribute("target", "_blank");
        expect(screen.getByText(/อย่าส่งคำขอซ้ำ/)).toBeInTheDocument();
    });

    it("separates confirmed validation failures and confirmed creation success from unknown outcomes", async () => {
        const rendered = render(<AddEmployeeForm canReadDepartments canReadEmployees />);
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มพนักงาน" }));
        await waitFor(() => expect(screen.getByText("กรุณากรอกชื่อ")).toBeInTheDocument());
        expect(mocks.post).not.toHaveBeenCalled();
        expect(document.querySelector('[data-navigation-unresolved="true"]')).not.toBeInTheDocument();
        rendered.unmount();

        mocks.post.mockResolvedValueOnce({ success: true, data: { success: true }, status: 201, requestId: "created" });
        render(<AddEmployeeForm canReadDepartments canReadEmployees />);
        fillFields({ firstName: "สมชาย", lastName: "ใจดี", email: "employee@example.test", phone: "0812345678", position: "Staff" });
        fireEvent.keyDown(screen.getByRole("combobox", { name: "แผนก" }), { key: "ArrowDown" });
        fireEvent.click(await screen.findByRole("option", { name: "IT" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มพนักงาน" }));

        await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
        await waitFor(() => expect(document.getElementById("email")).toHaveValue(""));
        expect(document.querySelector('[data-navigation-unresolved="true"]')).not.toBeInTheDocument();
        expect(allowDashboardNavigation()).toBe(true);
    });
});
