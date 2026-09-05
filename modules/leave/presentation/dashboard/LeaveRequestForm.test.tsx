import { useState, type ReactElement } from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveRequestForm } from "./LeaveRequestForm";
import type { LeaveQuota } from "./hooks/useLeaveProfile";
import { submitLeaveRequest } from "./api";

vi.mock("./api", () => ({
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
        id: "quota-1",
        year: 2031,
        employeeId: 1,
        leaveType: "SICK",
        totalDays,
        carryBalanceDays: 0,
        effectiveTotalDays: totalDays,
        usedDays,
        remainingDays: totalDays - usedDays,
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
                expect.any(String),
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
                expect.any(String),
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

    it("confirms before discarding evidence and revokes its preview after confirmation", async () => {
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

        expect(
            screen.getByRole("alertdialog", {
                name: "ทิ้งข้อมูลที่กรอกไว้?",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByAltText("ตัวอย่างรูปภาพ proof.jpg"),
        ).toBeInTheDocument();
        expect(onCancel).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "แก้ไขต่อ" }));
        expect(
            screen.getByAltText("ตัวอย่างรูปภาพ proof.jpg"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        fireEvent.click(screen.getByRole("button", { name: "ทิ้งข้อมูล" }));

        await waitFor(() =>
            expect(
                screen.queryByAltText("ตัวอย่างรูปภาพ proof.jpg"),
            ).not.toBeInTheDocument(),
        );
        expect(revokeObjectURL).toHaveBeenCalledWith(
            "blob:leave-evidence",
        );
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("asks before discarding dirty fields after a backdrop interaction", async () => {
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

        await waitForDismissLayer();
        fireBackdropPointerDown();

        expect(
            screen.getByRole("alertdialog", {
                name: "ทิ้งข้อมูลที่กรอกไว้?",
            }),
        ).toBeInTheDocument();
        expect(onCancel).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "แก้ไขต่อ" }));
        expect(screen.getByLabelText("เหตุผลการลา")).toHaveValue(
            "พักรักษาตัวตามคำแนะนำแพทย์",
        );
    });

    it("blocks Escape, backdrop, and close controls while submitting", async () => {
        vi.mocked(submitLeaveRequest).mockReturnValue(
            new Promise<never>(() => undefined),
        );
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
            expect(submitLeaveRequest).toHaveBeenCalledTimes(1),
        );
        expect(
            screen.getByRole("button", { name: "ปิดแบบฟอร์มยื่นคำขอลา" }),
        ).toBeDisabled();

        fireEvent.keyDown(document, { key: "Escape" });
        fireBackdropPointerDown();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        expect(onCancel).not.toHaveBeenCalled();
        expect(
            screen.getByRole("dialog", { name: "ยื่นคำขอลา" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("returns focus to the button that opened the form", async () => {
        render(<LeaveRequestFormHarness />);
        const trigger = screen.getByRole("button", {
            name: "เปิดแบบฟอร์มยื่นคำขอลา",
        });

        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        await waitFor(() => expect(trigger).toHaveFocus());
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});

function LeaveRequestFormHarness(): ReactElement {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                เปิดแบบฟอร์มยื่นคำขอลา
            </button>
            <LeaveRequestForm
                open={open}
                onCancel={() => setOpen(false)}
                onSuccess={() => undefined}
                quotas={[createQuota(10, 0)]}
            />
        </>
    );
}

function fireBackdropPointerDown(): void {
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    if (!(overlay instanceof HTMLElement)) {
        throw new Error("Dialog overlay not found");
    }

    fireEvent.pointerDown(overlay, { button: 0, pointerType: "mouse" });
}

async function waitForDismissLayer(): Promise<void> {
    await act(async () => {
        await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 0);
        });
    });
}
