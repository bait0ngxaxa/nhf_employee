import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { AddItemDialog } from "./StockInventoryAddItemDialog";

vi.mock("@/lib/client/api-client", () => ({
    apiPost: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

const categories = [
    { id: 1, name: "สำนักงาน" },
    { id: 2, name: "ไอที" },
];

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
    });
});

describe("AddItemDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiPost).mockImplementation(async (route) => {
            if (route === API_ROUTES.uploads.image) {
                return {
                    success: true,
                    data: { upload: { url: "/uploads/item.png" } },
                } as never;
            }

            return { success: true, data: {} } as never;
        });
    });

    it("preserves the complete draft during a session and resets it on the next session", async () => {
        render(<AddItemDialogHarness />);

        fireEvent.click(screen.getByRole("button", { name: "เปิดเพิ่มวัสดุ" }));
        fireEvent.change(screen.getByLabelText(/^ชื่อวัสดุ/), {
            target: { value: "กระดาษโน้ต" },
        });
        fireEvent.change(screen.getByLabelText(/^SKU หลัก/), {
            target: { value: "NOTE-001" },
        });
        fireEvent.change(screen.getByLabelText(/^รายละเอียด/), {
            target: { value: "ใช้สำหรับจดข้อความ" },
        });
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "สำนักงาน" }));
        fireEvent.change(screen.getByPlaceholderText("เช่น ชิ้น, เล่ม, รีม"), {
            target: { value: "เล่ม" },
        });
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มรายการ" }));
        fireEvent.change(screen.getAllByLabelText("ลิงก์รูปภาพ")[0] as HTMLInputElement, {
            target: {
                files: [new File(["image"], "item.png", { type: "image/png" })],
            },
        });
        await screen.findByAltText("ลิงก์รูปภาพ");

        fireEvent.click(screen.getByText("เรนเดอร์ใหม่"));

        expect(screen.getByLabelText(/^ชื่อวัสดุ/)).toHaveValue("กระดาษโน้ต");
        expect(screen.getByLabelText(/^SKU หลัก/)).toHaveValue("NOTE-001");
        expect(screen.getByLabelText(/^รายละเอียด/)).toHaveValue("ใช้สำหรับจดข้อความ");
        expect(screen.getByRole("combobox")).toHaveTextContent("สำนักงาน");
        expect(screen.getAllByPlaceholderText("เช่น ชิ้น, เล่ม, รีม")[0]).toHaveValue("เล่ม");
        expect(screen.getByAltText("ลิงก์รูปภาพ")).toBeInTheDocument();
        expect(screen.getByText("มี 2 รายการ")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        fireEvent.click(screen.getByRole("button", { name: "เปิดเพิ่มวัสดุ" }));

        expect(screen.getByLabelText(/^ชื่อวัสดุ/)).toHaveValue("");
        expect(screen.getByLabelText("SKU หลัก")).toHaveValue("");
        expect(screen.getByLabelText("รายละเอียด")).toHaveValue("");
        expect(screen.getByRole("combobox")).toHaveTextContent("เลือกหมวดหมู่");
        expect(screen.queryByAltText("ลิงก์รูปภาพ")).not.toBeInTheDocument();
        expect(screen.getByText("มี 1 รายการ")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("เช่น ชิ้น, เล่ม, รีม")).toHaveValue("");
    });

    it("keeps the existing item creation payload", async () => {
        const onSuccess = vi.fn();
        render(
            <AddItemDialog
                open
                sessionId={1}
                categories={categories}
                canManageInventory
                onClose={vi.fn()}
                onSuccess={onSuccess}
            />,
        );

        fireEvent.change(screen.getByLabelText(/^ชื่อวัสดุ/), {
            target: { value: "กระดาษโน้ต" },
        });
        fireEvent.change(screen.getByLabelText(/^SKU หลัก/), {
            target: { value: "NOTE-001" },
        });
        fireEvent.change(screen.getByLabelText(/^รายละเอียด/), {
            target: { value: "ใช้สำหรับจดข้อความ" },
        });
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "สำนักงาน" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));

        await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
            API_ROUTES.stock.items,
            {
                name: "กระดาษโน้ต",
                description: "ใช้สำหรับจดข้อความ",
                imageUrl: null,
                sku: "NOTE-001",
                categoryId: 1,
                variants: [{
                    sku: undefined,
                    unit: "",
                    quantity: 1,
                    minStock: 1,
                    imageUrl: null,
                    attributes: [],
                }],
            },
        ));
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("keeps the dialog from closing while an item is being saved", async () => {
        const onClose = vi.fn();
        vi.mocked(apiPost).mockImplementation(async (route) => {
            if (route === API_ROUTES.stock.items) {
                return new Promise<never>(() => undefined);
            }

            return { success: true, data: {} } as never;
        });

        render(
            <AddItemDialog
                open
                sessionId={1}
                categories={categories}
                canManageInventory
                onClose={onClose}
                onSuccess={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText(/^ชื่อวัสดุ/), {
            target: { value: "กระดาษโน้ต" },
        });
        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: "สำนักงาน" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกข้อมูล" }));

        await waitFor(() => expect(apiPost).toHaveBeenCalledWith(
            API_ROUTES.stock.items,
            expect.any(Object),
        ));
        expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(onClose).not.toHaveBeenCalled();
    });
});

function AddItemDialogHarness(): React.ReactElement {
    const [open, setOpen] = useState(false);
    const [sessionId, setSessionId] = useState(0);
    const [, setRenderVersion] = useState(0);

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setSessionId((current) => current + 1);
                    setOpen(true);
                }}
            >
                เปิดเพิ่มวัสดุ
            </button>
            <button type="button" onClick={() => setRenderVersion((current) => current + 1)}>
                เรนเดอร์ใหม่
            </button>
            <AddItemDialog
                open={open}
                sessionId={sessionId}
                categories={categories}
                canManageInventory
                onClose={() => setOpen(false)}
                onSuccess={() => setOpen(false)}
            />
        </>
    );
}
