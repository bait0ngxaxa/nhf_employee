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

    it("switches to multi-day mode and forces FULL_DAY period", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        act(() => {
            result.current.form.setValue("period", "MORNING");
            result.current.switchToMultiDay();
        });

        expect(result.current.isMultiDay).toBe(true);
        expect(result.current.form.getValues("period")).toBe("FULL_DAY");
    });

    it("switches back to single-day mode and syncs endDate to startDate", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        act(() => {
            result.current.switchToMultiDay();
            result.current.form.setValue("startDate", "2031-03-10");
            result.current.form.setValue("endDate", "2031-03-12");
            result.current.switchToSingleDay();
        });

        expect(result.current.isMultiDay).toBe(false);
        expect(result.current.form.getValues("endDate")).toBe("2031-03-10");
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

    it("sets generic error state when submit fails with unknown message", async () => {
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

    it("passes through Thai error messages without remapping", async () => {
        vi.mocked(submitLeaveRequest).mockRejectedValue(new Error("ยังไม่ได้ตั้งค่าผู้อนุมัติ"));
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        await act(async () => {
            await result.current.submit({
                leaveType: "VACATION",
                startDate: "2031-04-01",
                endDate: "2031-04-01",
                period: "FULL_DAY",
                reason: "thai-error",
            });
        });

        expect(result.current.errorMsg).toBe("ยังไม่ได้ตั้งค่าผู้อนุมัติ");
        expect(toast.error).toHaveBeenCalledWith("ยังไม่ได้ตั้งค่าผู้อนุมัติ");
    });

    it("maps known English backend message to Thai message", async () => {
        vi.mocked(submitLeaveRequest).mockRejectedValue(
            new Error("No manager is configured for this employee"),
        );
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        await act(async () => {
            await result.current.submit({
                leaveType: "VACATION",
                startDate: "2031-05-01",
                endDate: "2031-05-01",
                period: "FULL_DAY",
                reason: "mapped-error",
            });
        });

        expect(result.current.errorMsg).toBe("ยังไม่ได้ตั้งค่าผู้อนุมัติ");
        expect(toast.error).toHaveBeenCalledWith("ยังไม่ได้ตั้งค่าผู้อนุมัติ");
    });
});
