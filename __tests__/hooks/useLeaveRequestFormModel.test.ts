import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useLeaveRequestFormModel } from "@/hooks/leave/useLeaveRequestFormModel";
import { submitLeaveRequest } from "@/lib/services/leave/client";
import { LiffApiError } from "@/lib/client/liff";
import {
    LEAVE_ATTACHMENT_MAX_BYTES,
    LEAVE_ATTACHMENT_MAX_FILES,
} from "@/lib/ssot/leave-attachments";

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

    it("uses effective entitlement and authoritative remaining quota", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({
            onSuccess,
            quotas: [{
                leaveType: "PERSONAL",
                effectiveTotalDays: 15,
                usedDays: 14,
                remainingDays: 1,
            }],
        }));

        act(() => {
            result.current.form.setValue("leaveType", "PERSONAL");
            result.current.form.setValue("startDate", "2030-05-09");
            result.current.form.setValue("endDate", "2030-05-10");
        });

        expect(result.current.remainingQuota).toBe(1);
        expect(result.current.requestedDays).toBe(2);
        expect(result.current.overQuotaDays).toBe(1);
        expect(result.current.needsSpecialReason).toBe(true);
    });

    it("requires a special reason when the year starts over quota", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({
            onSuccess,
            quotas: [{
                leaveType: "PERSONAL",
                effectiveTotalDays: -2,
                usedDays: 0,
                remainingDays: -2,
            }],
        }));

        act(() => {
            result.current.form.setValue("leaveType", "PERSONAL");
            result.current.form.setValue("startDate", "2030-05-10");
            result.current.form.setValue("endDate", "2030-05-10");
        });

        expect(result.current.overQuotaDays).toBe(1);
        expect(result.current.needsSpecialReason).toBe(true);
    });

    it("resets multi-day state and clears form values", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const attachment = new File(["image"], "proof.jpg", {
            type: "image/jpeg",
        });

        act(() => {
            result.current.switchToMultiDay();
            result.current.form.setValue("reason", "ต้องลาพักผ่อน");
            result.current.addAttachments([attachment]);
            result.current.resetForm();
        });

        expect(result.current.isMultiDay).toBe(false);
        expect(result.current.form.getValues("leaveType")).toBe("SICK");
        expect(result.current.form.getValues("reason")).toBe("");
        expect(result.current.errorMsg).toBeNull();
        expect(result.current.attachments).toEqual([]);
    });

    it("stores valid attachments separately and removes one by index", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
        const second = new File(["second"], "second.png", { type: "image/png" });

        act(() => {
            result.current.addAttachments([first, second]);
        });

        expect(result.current.attachments).toEqual([first, second]);
        expect(result.current.form.getValues()).not.toHaveProperty("attachments");

        act(() => {
            result.current.removeAttachment(0);
        });

        expect(result.current.attachments).toEqual([second]);
        expect(result.current.attachmentError).toBeNull();
    });

    it("rejects attachments beyond the maximum count", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const files = Array.from(
            { length: LEAVE_ATTACHMENT_MAX_FILES + 1 },
            (_, index) =>
                new File(["image"], `proof-${index}.jpg`, {
                    type: "image/jpeg",
                }),
        );

        act(() => {
            result.current.addAttachments(files);
        });

        expect(result.current.attachments).toEqual([]);
        expect(result.current.attachmentError).toBe(
            "แนบไฟล์ได้สูงสุด 3 ไฟล์",
        );
    });

    it("rejects an unsupported attachment MIME type", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        act(() => {
            result.current.addAttachments([
                new File(["document"], "proof.pdf", {
                    type: "application/pdf",
                }),
            ]);
        });

        expect(result.current.attachments).toEqual([]);
        expect(result.current.attachmentError).toBe(
            "รองรับเฉพาะไฟล์ JPG, PNG และ WEBP",
        );
    });

    it("rejects an attachment larger than the per-file limit", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));

        act(() => {
            result.current.addAttachments([
                new File(
                    [new Uint8Array(LEAVE_ATTACHMENT_MAX_BYTES + 1)],
                    "large.jpg",
                    { type: "image/jpeg" },
                ),
            ]);
        });

        expect(result.current.attachments).toEqual([]);
        expect(result.current.attachmentError).toBe(
            "ไฟล์รูปภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 8 MB",
        );
    });

    it("rejects attachments beyond the combined size limit", () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const sevenMegabytes = 7 * 1024 * 1024;
        const files = Array.from(
            { length: 3 },
            (_, index) =>
                new File(
                    [new Uint8Array(sevenMegabytes)],
                    `proof-${index}.webp`,
                    { type: "image/webp" },
                ),
        );

        act(() => {
            result.current.addAttachments(files);
        });

        expect(result.current.attachments).toEqual([]);
        expect(result.current.attachmentError).toBe(
            "ไฟล์รูปภาพรวมต้องมีขนาดไม่เกิน 20 MB",
        );
    });

    it("submits leave request successfully", async () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const payload = {
            leaveType: "SICK" as const,
            startDate: "2031-01-01",
            endDate: "2031-01-01",
            period: "FULL_DAY" as const,
            reason: "test",
        };

        await act(async () => {
            await result.current.submit(payload);
        });

        expect(submitLeaveRequest).toHaveBeenCalledTimes(1);
        expect(submitLeaveRequest).toHaveBeenCalledWith(
            payload,
            [],
            expect.any(String),
        );
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(result.current.errorMsg).toBeNull();
    });

    it("keeps attachments when submission fails so the user can retry", async () => {
        vi.mocked(submitLeaveRequest).mockRejectedValue(
            new Error("ระบบไม่พร้อมใช้งาน"),
        );
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const attachment = new File(["image"], "proof.jpg", {
            type: "image/jpeg",
        });

        act(() => {
            result.current.addAttachments([attachment]);
        });
        await act(async () => {
            await result.current.submit({
                leaveType: "SICK",
                startDate: "2031-01-01",
                endDate: "2031-01-01",
                period: "FULL_DAY",
                reason: "พักรักษาตัว",
            });
        });

        expect(submitLeaveRequest).toHaveBeenCalledWith(
            expect.any(Object),
            [attachment],
            expect.any(String),
        );
        const firstIdempotencyKey = vi.mocked(submitLeaveRequest).mock.calls[0]?.[2];
        await act(async () => {
            await result.current.submit({
                leaveType: "SICK",
                startDate: "2031-01-01",
                endDate: "2031-01-01",
                period: "FULL_DAY",
                reason: "พักรักษาตัว",
            });
        });
        expect(vi.mocked(submitLeaveRequest).mock.calls[1]?.[2]).toBe(
            firstIdempotencyKey,
        );
        expect(result.current.attachments).toEqual([attachment]);
    });

    it("refreshes before an explicit retry and keeps the Leave idempotency key after recovered ambiguity", async () => {
        const submitRequest = vi.fn()
            .mockRejectedValueOnce(
                new LiffApiError(
                    "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว",
                    401,
                    undefined,
                    { recovered: true, replayed: false },
                ),
            )
            .mockResolvedValueOnce(undefined);
        const onSubmitError = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useLeaveRequestFormModel({
            onSuccess,
            onSubmitError,
            submitRequest,
        }));
        const payload = {
            leaveType: "SICK" as const,
            startDate: "2031-01-01",
            endDate: "2031-01-01",
            period: "FULL_DAY" as const,
            reason: "พักรักษาตัว",
        };

        await act(async () => {
            await result.current.submit(payload);
        });
        expect(onSubmitError).toHaveBeenCalledOnce();
        expect(result.current.errorMsg).toBe("เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว");
        const firstKey = submitRequest.mock.calls[0]?.[2];

        await act(async () => {
            await result.current.submit(payload);
        });

        expect(submitRequest).toHaveBeenCalledTimes(2);
        expect(submitRequest.mock.calls[1]?.[2]).toBe(firstKey);
        expect(onSuccess).toHaveBeenCalledOnce();
    });

    it("clears attachments only after a successful submission", async () => {
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const attachment = new File(["image"], "proof.webp", {
            type: "image/webp",
        });

        act(() => {
            result.current.addAttachments([attachment]);
        });
        await act(async () => {
            await result.current.submit({
                leaveType: "SICK",
                startDate: "2031-01-01",
                endDate: "2031-01-01",
                period: "FULL_DAY",
                reason: "พักรักษาตัว",
            });
        });

        expect(submitLeaveRequest).toHaveBeenCalledWith(
            expect.any(Object),
            [attachment],
            expect.any(String),
        );
        expect(result.current.attachments).toEqual([]);
    });

    it("does not offer a retry when refresh fails after the request succeeds", async () => {
        const refreshAfterSuccess = vi
            .fn()
            .mockRejectedValue(new Error("refresh failed"));
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const { result } = renderHook(() =>
            useLeaveRequestFormModel({ onSuccess: refreshAfterSuccess }),
        );
        const attachment = new File(["image"], "proof.jpg", {
            type: "image/jpeg",
        });

        act(() => {
            result.current.addAttachments([attachment]);
        });
        await act(async () => {
            await result.current.submit({
                leaveType: "SICK",
                startDate: "2031-01-01",
                endDate: "2031-01-01",
                period: "FULL_DAY",
                reason: "พักรักษาตัว",
            });
        });

        expect(submitLeaveRequest).toHaveBeenCalledTimes(1);
        expect(refreshAfterSuccess).toHaveBeenCalledTimes(1);
        expect(result.current.attachments).toEqual([]);
        expect(result.current.errorMsg).toBeNull();
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(toast.error).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });

    it("prevents a second submission while the first is pending", async () => {
        let finishSubmission: (() => void) | undefined;
        vi.mocked(submitLeaveRequest).mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    finishSubmission = resolve;
                }),
        );
        const { result } = renderHook(() => useLeaveRequestFormModel({ onSuccess }));
        const payload = {
            leaveType: "SICK" as const,
            startDate: "2031-01-01",
            endDate: "2031-01-01",
            period: "FULL_DAY" as const,
            reason: "พักรักษาตัว",
        };
        let firstSubmission: Promise<void> | undefined;
        let secondSubmission: Promise<void> | undefined;

        await act(async () => {
            firstSubmission = result.current.submit(payload);
            secondSubmission = result.current.submit(payload);
            await Promise.resolve();
        });

        expect(submitLeaveRequest).toHaveBeenCalledTimes(1);

        await act(async () => {
            finishSubmission?.();
            await Promise.all([firstSubmission, secondSubmission]);
        });
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
