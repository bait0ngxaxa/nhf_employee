import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiPost } from "@/lib/client/api-client";
import { REQUEST_BODY_INVALID_JSON_MESSAGE } from "@/lib/ssot/request-limits";
import { useAddEmployee } from "./useAddEmployee";

vi.mock("@/lib/client/api-client", () => ({ apiPost: vi.fn() }));
vi.mock("swr", () => ({ default: () => ({ data: { departments: [] } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

describe("employee submission outcome", () => {
    it.each([400, 500])("keeps malformed JSON 400 editable and 500 locked (status %s)", async (status) => {
        vi.mocked(apiPost).mockResolvedValueOnce({
            success: false, status, error: REQUEST_BODY_INVALID_JSON_MESSAGE,
            errorThai: REQUEST_BODY_INVALID_JSON_MESSAGE,
            code: status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR",
        });
        const { result } = renderHook(() => useAddEmployee({ canReadDepartments: true }));
        act(() => {
            result.current.handleFieldChange("firstName", "สมชาย");
            result.current.handleFieldChange("lastName", "ใจดี");
            result.current.handleFieldChange("email", "employee@example.test");
            result.current.handleFieldChange("phone", "0812345678");
            result.current.handleFieldChange("position", "Staff");
            result.current.handleFieldChange("departmentId", "1");
        });
        await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent));
        expect(result.current.error).toBe(REQUEST_BODY_INVALID_JSON_MESSAGE);
        expect(result.current.hasUnresolvedSubmission).toBe(status === 500);
        act(() => result.current.handleFieldChange("position", "Manager"));
        expect(result.current.formData.position).toBe(status === 400 ? "Manager" : "Staff");
    });
});
