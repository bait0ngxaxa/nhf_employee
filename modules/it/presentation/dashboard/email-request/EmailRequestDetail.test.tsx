import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiPatch } from "@/lib/client/api-client";
import { toast } from "sonner";
import type { EmailRequest } from "../../../domain/email-request/contracts";
import { EmailRequestDetail } from "./EmailRequestDetail";

vi.mock("@/lib/client/api-client", () => ({ apiPatch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const request: EmailRequest = { id: 128, thaiName: "สมชาย", englishName: "Somchai", nickname: "ชาย", phone: "081-2345678", position: "IT", department: "มสช.",
    replyEmail: "reply@example.com", requestedBy: 7, needsDocumentSystem: false, canUpdateAccessRequirements: true,
    documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [], accessVersion: 1,
    createdAt: "2026-10-01T03:00:00.000Z", updatedAt: "2026-10-01T03:00:00.000Z" };

describe("Email Request access detail editor", () => {
    beforeEach(() => { vi.clearAllMocks(); });
    it("requires drives only for REQUIRED and submits both independent decisions with expected version", async () => {
        const onSaved = vi.fn();
        vi.mocked(apiPatch).mockResolvedValue({ success: true, status: 200, requestId: "test", data: { changed: true,
            data: { ...request, documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it"], accessVersion: 2 } } });
        render(<EmailRequestDetail request={request} onClose={vi.fn()} onSaved={onSaved} />);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขสิทธิ์การใช้งาน" }));
        fireEvent.click(within(screen.getByRole("group", { name: "ระบบสารบรรณ" })).getByRole("radio", { name: "ต้องใช้" }));
        fireEvent.click(within(screen.getByRole("group", { name: "Shared Drive" })).getByRole("radio", { name: "ต้องใช้" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและแจ้งทีม IT" }));
        expect(screen.getByRole("alert")).toHaveTextContent("กรุณาเลือก Shared Drive อย่างน้อยหนึ่งรายการ");
        expect(apiPatch).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("checkbox", { name: "it" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและแจ้งทีม IT" }));
        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(apiPatch).toHaveBeenCalledWith("/api/email-request/128/access-requirements", {
            documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it"], expectedAccessVersion: 1,
        });
        expect(screen.getByText("ต้องใช้: it")).toBeInTheDocument();
    });
    it("reports no-op honestly instead of claiming IT was notified", async () => {
        vi.mocked(apiPatch).mockResolvedValue({ success: true, status: 200, requestId: "test", data: { changed: false, data: request } });
        render(<EmailRequestDetail request={request} onClose={vi.fn()} onSaved={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขสิทธิ์การใช้งาน" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและแจ้งทีม IT" }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("สิทธิ์การใช้งานไม่มีการเปลี่ยนแปลง"));
    });
    it("retains conflict feedback and forces a reload before retrying", async () => {
        const onClose = vi.fn(); const onSaved = vi.fn();
        vi.mocked(apiPatch).mockResolvedValue({ success: false, status: 409, code: "UNKNOWN_ERROR", error: "conflict", errorThai: "สิทธิ์ถูกแก้ไขแล้ว กรุณาโหลดใหม่" });
        render(<EmailRequestDetail request={request} onClose={onClose} onSaved={onSaved} />);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขสิทธิ์การใช้งาน" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและแจ้งทีม IT" }));
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("สิทธิ์ถูกแก้ไขแล้ว"));
        expect(screen.getByRole("button", { name: "บันทึกและแจ้งทีม IT" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "โหลดรายการล่าสุด แล้วเปิดคำร้องอีกครั้ง" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSaved).toHaveBeenCalledTimes(1);
    });
    it("clears selected drives when changing to NOT_REQUIRED", async () => {
        vi.mocked(apiPatch).mockResolvedValue({ success: true, status: 200, requestId: "test", data: { changed: true, data: { ...request, sharedDriveDecision: "NOT_REQUIRED" } } });
        render(<EmailRequestDetail request={{ ...request, sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it"] }} onClose={vi.fn()} onSaved={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขสิทธิ์การใช้งาน" }));
        fireEvent.click(within(screen.getByRole("group", { name: "Shared Drive" })).getByRole("radio", { name: "ไม่ต้องใช้" }));
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและแจ้งทีม IT" }));
        await waitFor(() => expect(apiPatch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ sharedDriveDecision: "NOT_REQUIRED", sharedDriveAccess: [] })));
    });
});
