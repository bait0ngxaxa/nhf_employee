import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiPut } from "@/lib/client/api-client";
import { PendingSpecialReasonEditor } from "./PendingSpecialReasonEditor";

vi.mock("@/lib/client/api-client", () => ({ apiPut: vi.fn() }));

describe.each(["dashboard", "liff"] as const)("%s special reason editor", (channel) => {
    it("adds or updates an explanation and refreshes the original request", async () => {
        vi.mocked(apiPut).mockResolvedValue({ success: true, data: {}, status: 200, requestId: "test" });
        const onSuccess = vi.fn();
        render(<PendingSpecialReasonEditor leaveId="leave-1" specialReason={null} channel={channel} onSuccess={onSuccess} />);
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มเหตุผลกรณีลาเกินสิทธิ์" }));
        const textarea = screen.getByRole("textbox", { name: "เหตุผลกรณีลาเกินสิทธิ์" });
        expect(textarea).toHaveAccessibleDescription(expect.stringContaining("ยังไม่หักสิทธิ์"));
        fireEvent.change(textarea, { target: { value: "จำเป็นต้องดูแลครอบครัว" } });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกเหตุผลพิเศษ" }));
        await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
        expect(apiPut).toHaveBeenCalledWith(channel === "liff" ? "/api/line/leave/special-reason" : "/api/leave/special-reason", { leaveId: "leave-1", specialReason: "จำเป็นต้องดูแลครอบครัว", expectedSpecialReason: null }, expect.any(Object));
    });
    it("preserves the draft and shows an actionable conflict", async () => {
        vi.mocked(apiPut).mockResolvedValue({ success: false, code: "NETWORK_ERROR", errorThai: "", error: "คำขอนี้ถูกดำเนินการแล้ว กรุณารีเฟรชรายการ" });
        render(<PendingSpecialReasonEditor leaveId="leave-1" specialReason="เหตุผลเดิม" channel={channel} onSuccess={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขเหตุผลกรณีลาเกินสิทธิ์" }));
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "แก้ไขเหตุผลเป็นข้อความใหม่" } });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกเหตุผลพิเศษ" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("กรุณารีเฟรชรายการ");
        expect(screen.getByRole("textbox")).toHaveValue("แก้ไขเหตุผลเป็นข้อความใหม่");
    });
});
