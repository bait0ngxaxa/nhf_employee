import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveRequestForm } from "@/components/dashboard/leave/LeaveRequestForm";
import type { LeaveQuota } from "@/hooks/useLeaveProfile";
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

function createQuota(totalDays: number, usedDays: number): LeaveQuota {
    return {
        id: 1,
        year: 2031,
        employeeId: 1,
        leaveType: "SICK",
        totalDays,
        usedDays,
        createdAt: "2031-01-01T00:00:00.000Z",
        updatedAt: "2031-01-01T00:00:00.000Z",
    };
}

describe("LeaveRequestForm", () => {
    const onCancel = vi.fn();
    const onSuccess = vi.fn();
    const createObjectURL = vi.fn(() => "blob:leave-evidence");
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(submitLeaveRequest).mockResolvedValue(undefined);
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: createObjectURL,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: revokeObjectURL,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        Reflect.deleteProperty(URL, "createObjectURL");
        Reflect.deleteProperty(URL, "revokeObjectURL");
    });

    it("renders the leave request form as an accessible modal dialog", () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );

        expect(screen.getByRole("dialog", { name: "ยื่นคำขอลา" })).toBeInTheDocument();
        expect(
            screen.getByText(
                "กรอกช่วงวันที่และเหตุผลให้ครบถ้วน ระบบจะตรวจเงื่อนไขลาย้อนหลังและการลาเกินสิทธิ์ให้ก่อนส่งคำขอ",
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "ปิดแบบฟอร์มยื่นคำขอลา" }),
        ).toBeInTheDocument();
    });

    it("calls cancel callback from the dialog footer", () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("shows special reason requirements when the request exceeds quota", () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(1, 1)]}
            />,
        );

        fireEvent.change(screen.getByLabelText("วันที่ลา"), {
            target: { value: "2031-01-06" },
        });

        expect(screen.getByLabelText("เหตุผลพิเศษ")).toBeInTheDocument();
        expect(screen.getAllByText(/คำขอนี้เกินสิทธิ์ 1 วัน/).length).toBeGreaterThan(0);
    });

    it("uses clear backdated leave copy when the leave date is in the past", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2031-01-10T12:00:00.000Z"));

        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );

        fireEvent.change(screen.getByLabelText("วันที่ลา"), {
            target: { value: "2031-01-08" },
        });

        expect(
            screen.getByText(
                "ลาย้อนหลัง: ระบุเหตุผลในการลาย้อนหลัง เพื่อให้ผู้อนุมัติเห็นว่าทำไมจึงยื่นไม่ทัน",
            ),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("เหตุผลในการลาย้อนหลัง")).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("ระบุเหตุผลที่ทำให้ยื่นคำขอลาหลังวันที่ลา"),
        ).toBeInTheDocument();
    });

    it("submits a leave request without attachments", async () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), {
            target: { value: "พักรักษาตัวตามคำแนะนำแพทย์" },
        });

        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอลา" }));

        await waitFor(() =>
            expect(submitLeaveRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: "พักรักษาตัวตามคำแนะนำแพทย์",
                }),
                [],
            ),
        );
    });

    it("submits selected evidence with the leave request", async () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );
        const file = new File(["image"], "proof.jpg", {
            type: "image/jpeg",
        });
        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            { target: { files: [file] } },
        );
        await screen.findByAltText("ตัวอย่างรูปภาพ proof.jpg");
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), {
            target: { value: "พักรักษาตัวตามคำแนะนำแพทย์" },
        });

        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอลา" }));

        await waitFor(() =>
            expect(submitLeaveRequest).toHaveBeenCalledWith(
                expect.any(Object),
                [file],
            ),
        );
    });

    it("keeps selected evidence visible after submission fails", async () => {
        vi.mocked(submitLeaveRequest).mockRejectedValue(
            new Error("ระบบไม่พร้อมใช้งาน"),
        );
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );
        const file = new File(["image"], "proof.png", {
            type: "image/png",
        });
        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            { target: { files: [file] } },
        );
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), {
            target: { value: "พักรักษาตัวตามคำแนะนำแพทย์" },
        });

        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอลา" }));

        await screen.findByText("ระบบไม่พร้อมใช้งาน");
        expect(
            screen.getByAltText("ตัวอย่างรูปภาพ proof.png"),
        ).toBeInTheDocument();
        expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it("clears evidence and revokes its preview after submission succeeds", async () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );
        const file = new File(["image"], "proof.webp", {
            type: "image/webp",
        });
        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            { target: { files: [file] } },
        );
        await screen.findByAltText("ตัวอย่างรูปภาพ proof.webp");
        fireEvent.change(screen.getByLabelText("เหตุผลการลา"), {
            target: { value: "พักรักษาตัวตามคำแนะนำแพทย์" },
        });

        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอลา" }));

        await waitFor(() =>
            expect(
                screen.queryByAltText("ตัวอย่างรูปภาพ proof.webp"),
            ).not.toBeInTheDocument(),
        );
        expect(revokeObjectURL).toHaveBeenCalledWith(
            "blob:leave-evidence",
        );
    });

    it("resets evidence and revokes its preview when the dialog is cancelled", async () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );
        const file = new File(["image"], "proof.jpg", {
            type: "image/jpeg",
        });
        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            { target: { files: [file] } },
        );
        await screen.findByAltText("ตัวอย่างรูปภาพ proof.jpg");

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        await waitFor(() =>
            expect(
                screen.queryByAltText("ตัวอย่างรูปภาพ proof.jpg"),
            ).not.toBeInTheDocument(),
        );
        expect(revokeObjectURL).toHaveBeenCalledWith(
            "blob:leave-evidence",
        );
    });
});
