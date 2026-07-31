import { useState, type ReactElement } from "react";
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth/HybridAuthProvider";
import CreateTicketForm from "@/components/ticket/CreateTicketForm";
import { apiPost } from "@/lib/client/api-client";

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiPost: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
    });
});

describe("CreateTicketForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "7",
                role: "EMPLOYEE",
                email: "employee@example.com",
            },
        } as never);
    });

    it("asks for confirmation before discarding entered ticket data", () => {
        const onClose = vi.fn();
        render(
            <CreateTicketForm
                isOpen
                onClose={onClose}
            />,
        );

        fireEvent.change(screen.getByLabelText("หัวข้อปัญหา *"), {
            target: { value: "เครื่องเปิดไม่ติด" },
        });
        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).not.toHaveBeenCalled();
        expect(
            screen.getByRole("alertdialog", {
                name: "ทิ้งข้อมูลที่กรอกไว้?",
            }),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "แก้ไขต่อ" }));
        expect(screen.getByLabelText("หัวข้อปัญหา *")).toHaveValue(
            "เครื่องเปิดไม่ติด",
        );

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        fireEvent.click(screen.getByRole("button", { name: "ทิ้งข้อมูล" }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText("หัวข้อปัญหา *")).toHaveValue("");
    });

    it("blocks Escape, backdrop, and close controls while submitting", async () => {
        const onClose = vi.fn();
        vi.mocked(apiPost).mockReturnValue(new Promise<never>(() => undefined));
        render(
            <CreateTicketForm
                isOpen
                onClose={onClose}
            />,
        );

        fireEvent.change(screen.getByLabelText("หัวข้อปัญหา *"), {
            target: { value: "เครื่องเปิดไม่ติด" },
        });
        fireEvent.change(screen.getByLabelText("รายละเอียดปัญหา *"), {
            target: { value: "กดปุ่มเปิดแล้วไม่มีไฟสถานะ" },
        });
        fireEvent.click(screen.getAllByRole("combobox")[0]);
        fireEvent.click(screen.getByRole("option", { name: "ฮาร์ดแวร์" }));
        fireEvent.click(
            screen.getByRole("button", { name: "ส่งคำร้องแจ้งปัญหา" }),
        );

        await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
        expect(
            screen.getByRole("button", { name: "ปิดแบบฟอร์มแจ้งปัญหาไอที" }),
        ).toBeDisabled();

        fireEvent.keyDown(document, { key: "Escape" });
        fireBackdropPointerDown();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        expect(onClose).not.toHaveBeenCalled();
        expect(
            screen.getByRole("dialog", { name: "แจ้งปัญหาไอที" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("returns focus to the button that opened the dialog", async () => {
        render(<CreateTicketFormHarness />);
        const trigger = screen.getByRole("button", {
            name: "เปิดแบบฟอร์มแจ้งปัญหา",
        });

        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        await waitFor(() => expect(trigger).toHaveFocus());
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});

function CreateTicketFormHarness(): ReactElement {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                เปิดแบบฟอร์มแจ้งปัญหา
            </button>
            <CreateTicketForm
                isOpen={open}
                onClose={() => setOpen(false)}
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
