import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useLeaveRequestFormModel } from "@/hooks/leave/useLeaveRequestFormModel";
import { submitLeaveRequest } from "@/lib/services/leave/client";

vi.mock("@/lib/services/leave/client", () => ({
    submitLeaveRequest: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("useLeaveRequestFormModel", () => {
    const onSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(submitLeaveRequest).mockResolvedValue(undefined);
    });

    it("syncs endDate with startDate in single-day mode", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        act(() => {
            result.current.handleStartDateChange("2031-01-03", () => undefined);
        });

        expect(result.current.form.getValues("endDate")).toBe("2031-01-03");
    });

    it("submits leave request successfully", async () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        await act(async () => {
            await result.current.submit({
                leaveType: "SICK",
                startDate: "2031-01-01",
                endDate: "2031-01-01",
                period: "FULL_DAY",
                reason: "test",
            });
        });

        expect(submitLeaveRequest).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(result.current.errorMsg).toBeNull();
    });

    it("sets error state when submit fails", async () => {
        vi.mocked(submitLeaveRequest).mockRejectedValue(new Error("custom-error"));
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        await act(async () => {
            await result.current.submit({
                leaveType: "PERSONAL",
                startDate: "2031-02-01",
                endDate: "2031-02-01",
                period: "FULL_DAY",
                reason: "err",
            });
        });

        expect(result.current.errorMsg).toBe("ไม่สามารถส่งคำขอลาได้ กรุณาลองใหม่อีกครั้ง");
        expect(toast.error).toHaveBeenCalledWith("ไม่สามารถส่งคำขอลาได้ กรุณาลองใหม่อีกครั้ง");
    });
});
