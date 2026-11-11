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


});
