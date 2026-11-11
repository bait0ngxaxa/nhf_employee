import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowDashboardNavigation } from "@/lib/ui/dashboard-navigation-guard";
import type { ApiResponse } from "@/lib/client/api-client";
import { EmailRequestForm } from "./EmailRequestForm";
import { EmailRequestProvider } from "./EmailRequestProvider";

const mocks = vi.hoisted(() => ({ post: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/client/api-client", () => ({ apiPost: mocks.post, apiGet: vi.fn() }));
vi.mock("swr", () => ({ default: () => ({ data: { emailRequests: [] }, isLoading: false, error: null, mutate: mocks.mutate }) }));
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
    it("locks the submitted payload and retries an unresolved email request with its original key", async () => {
        const request = deferred<ApiResponse<unknown>>();
        mocks.post.mockReturnValueOnce(request.promise)
            .mockRejectedValueOnce(new TypeError("connection lost"))
            .mockResolvedValueOnce({ success: true, data: { success: true }, status: 200, requestId: "test" });
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
        expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining("ข้อมูลชุดเดิม"));
        const originalName = screen.getByDisplayValue("สมชาย ใจดี");
        expect(originalName).toBeDisabled();
        fireEvent.change(originalName, { target: { value: "ข้อมูลที่แก้ไขต้องไม่ถูกบันทึก" } });
        expect(screen.getByDisplayValue("สมชาย ใจดี")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /ส่งคำร้องเดิมอีกครั้ง/ }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
        expect(allowDashboardNavigation()).toBe(false);

        fireEvent.click(screen.getByRole("button", { name: /ส่งคำร้องเดิมอีกครั้ง/ }));
        await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(3));
        await waitFor(() => expect(allowDashboardNavigation()).toBe(true));
        const firstAttempt = mocks.post.mock.calls[0];
        for (const retry of mocks.post.mock.calls.slice(1)) {
            expect(retry?.[1]).toEqual(firstAttempt?.[1]);
            expect(retry?.[2]).toEqual(firstAttempt?.[2]);
        }
        expect(firstAttempt?.[2]).toMatchObject({ headers: { "Idempotency-Key": expect.any(String) } });
        expect(document.querySelector("#thaiName")).toHaveValue("");
    });
});
