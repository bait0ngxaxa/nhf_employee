import { act, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiPatch } from "@/lib/client/api-client";
import type { Employee } from "../types";
import { useEditEmployee } from "./useEditEmployee";

vi.mock("swr", () => ({ default: () => ({ data: undefined }) }));
vi.mock("@/lib/client/api-client", () => ({ apiPatch: vi.fn() }));

const employee: Employee = {
    id: 7, firstName: "สมใจ", lastName: "ใจดี", nickname: null,
    phone: null, email: "employee@example.org", position: "เจ้าหน้าที่",
    affiliation: null, hireDate: "2023-04-01", status: "ACTIVE",
    dept: { id: 1, name: "บริหาร", code: "ADMIN" },
    createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z",
};
const event = { preventDefault: vi.fn() } as unknown as FormEvent;

function setup(hireDate: string | null = employee.hireDate) {
    return renderHook(({ savedEmployee }) => useEditEmployee({
        employee: savedEmployee, isOpen: true, canReadDepartments: false, onClose: vi.fn(),
    }), { initialProps: { savedEmployee: { ...employee, hireDate } } });
}

describe("edit employee hire date PATCH contract", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiPatch).mockResolvedValue({ success: true, data: {}, status: 200, requestId: "test" });
    });

    it.each(["phone", "position"] as const)("omits hireDate when editing %s", async (field) => {
        const { result } = setup();
        act(() => result.current.handleFieldChange(field, field === "phone" ? "0812345678" : "ผู้ประสานงาน"));
        await act(() => result.current.handleSubmit(event));
        expect(apiPatch).toHaveBeenCalledOnce();
        expect(vi.mocked(apiPatch).mock.calls[0][1]).not.toHaveProperty("hireDate");
    });

    it.each([
        [null, "2023-04-01", "2023-04-01"],
        ["2023-04-01", "2024-02-29", "2024-02-29"],
        ["2023-04-01", "", null],
    ])("sends only an intentional date change from %s to %s", async (saved, edited, expected) => {
        const { result } = setup(saved);
        act(() => result.current.handleFieldChange("hireDate", edited));
        await act(() => result.current.handleSubmit(event));
        expect(apiPatch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ hireDate: expected }));
    });

    it.each([null, "2023-04-01"])("omits an unchanged date (%s)", async (date) => {
        const { result } = setup(date);
        expect(result.current.formData.hireDate).toBe(date ?? "");
        await act(() => result.current.handleSubmit(event));
        expect(vi.mocked(apiPatch).mock.calls[0][1]).not.toHaveProperty("hireDate");
    });

    it("omits a date changed back to its original value", async () => {
        const { result } = setup();
        act(() => result.current.handleFieldChange("hireDate", ""));
        act(() => result.current.handleFieldChange("hireDate", "2023-04-01"));
        await act(() => result.current.handleSubmit(event));
        expect(vi.mocked(apiPatch).mock.calls[0][1]).not.toHaveProperty("hireDate");
    });

    it("does not restore a stale date after another editor changes it and props refresh", async () => {
        const { result, rerender } = setup();
        act(() => result.current.handleFieldChange("phone", "0812345678"));
        rerender({ savedEmployee: { ...employee, hireDate: "2025-07-01" } });
        await act(() => result.current.handleSubmit(event));
        const payload = vi.mocked(apiPatch).mock.calls[0][1];
        expect(payload).not.toHaveProperty("hireDate");
        if (typeof payload !== "object" || payload === null) throw new Error("Expected PATCH object");
        const latestDatabaseEmployee = { ...employee, hireDate: "2025-07-01" };
        expect({ ...latestDatabaseEmployee, ...payload }).toHaveProperty("hireDate", "2025-07-01");
    });
});
