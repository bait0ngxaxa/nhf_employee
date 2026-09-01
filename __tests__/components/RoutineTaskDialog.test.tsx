import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactElement } from "react";

import { RoutineTaskDialog } from "@/components/dashboard/routine/RoutineTaskDialog";
import type {
    RoutineReferenceData,
    RoutineTask,
} from "@/components/dashboard/routine/types";

const reference: RoutineReferenceData = {
    units: [{ id: 1, code: "มสช.", name: "มสช." }],
    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
    employees: [{
        id: 11,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: null,
    }],
};

const task = {
    canEdit: true,
    canDelete: true,
    id: 71,
    unitId: 1,
    categoryId: 1,
    title: "ตรวจสอบระบบ",
    description: null,
    scheduleType: "MONTHLY_DAY",
    scheduleConfig: { day: 10, monthOffset: 0 },
    scheduleText: null,
    contractStartDate: null,
    contractEndDate: null,
    contractText: null,
    extraDetails: null,
    businessDayPolicy: "NONE",
    isActive: true,
    version: 1,
    sourceFileName: null,
    sourceSheet: null,
    sourceRow: null,
    createdById: 5,
    updatedById: 5,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    unit: { id: 1, code: "มสช.", name: "มสช." },
    category: { id: 1, name: "ระบบคอมพิวเตอร์" },
    assignees: [{
        employeeId: 11,
        role: "OWNER",
        employee: {
            id: 11,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
        },
    }],
    reminderRules: [],
    _count: { occurrences: 1 },
} satisfies RoutineTask;

describe("RoutineTaskDialog", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ task: { id: 1 } }), { status: 201 }),
        ));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders create and edit modes as accessible dialogs", () => {
        const { rerender } = render(
            <RoutineTaskDialog
                open
                intent="create"
                mode="SELF_SERVICE"
                reference={reference}
                task={null}
                isLoading={false}
                onRetry={vi.fn()}
                onClose={vi.fn()}
                onSaved={vi.fn()}
            />,
        );

        expect(screen.getByRole("dialog", { name: "สร้างแม่แบบงานของฉัน" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ปิดแบบฟอร์ม Routine" })).toBeInTheDocument();

        rerender(
            <RoutineTaskDialog
                open
                intent="edit"
                mode="ADMIN"
                reference={reference}
                task={task}
                isLoading={false}
                onRetry={vi.fn()}
                onClose={vi.fn()}
                onSaved={vi.fn()}
            />,
        );

        expect(screen.getByRole("dialog", { name: "แก้ไข Routine" })).toBeInTheDocument();
        expect(screen.getByDisplayValue("ตรวจสอบระบบ")).toBeInTheDocument();
    });

    it("closes a pristine form from the footer and restores trigger focus", async () => {
        render(<RoutineTaskDialogHarness />);
        const trigger = screen.getByRole("button", { name: "เปิดแบบฟอร์ม Routine" });

        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it("routes X, Escape, and backdrop dismissal through the existing dirty guard", async () => {
        const onClose = vi.fn();
        render(
            <RoutineTaskDialog
                open
                intent="create"
                mode="SELF_SERVICE"
                reference={reference}
                task={null}
                isLoading={false}
                onRetry={vi.fn()}
                onClose={onClose}
                onSaved={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), {
            target: { value: "งานที่ยังไม่ได้บันทึก" },
        });

        fireEvent.click(screen.getByRole("button", { name: "ปิดแบบฟอร์ม Routine" }));
        expect(screen.getByRole("alertdialog", { name: "มีข้อมูลที่ยังไม่ได้บันทึก" })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "กลับไปแก้ไข" }));

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.getByRole("alertdialog", { name: "มีข้อมูลที่ยังไม่ได้บันทึก" })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "กลับไปแก้ไข" }));

        await waitForDismissLayer();
        fireBackdropPointerDown();
        expect(screen.getByRole("alertdialog", { name: "มีข้อมูลที่ยังไม่ได้บันทึก" })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "ออกโดยไม่บันทึก" }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes after a successful save through the parent callback", async () => {
        const onSaved = vi.fn();
        render(<RoutineTaskDialogHarness onSaved={onSaved} initiallyOpen />);

        fireEvent.change(screen.getByDisplayValue("เลือกหน่วยงาน"), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByDisplayValue("เลือกหมวดหมู่"), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), {
            target: { value: "ตรวจสอบระบบรายเดือน" },
        });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกงานของฉัน" }));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
});

function RoutineTaskDialogHarness({
    initiallyOpen = false,
    onSaved = vi.fn(),
}: {
    initiallyOpen?: boolean;
    onSaved?: () => void;
}): ReactElement {
    const [open, setOpen] = useState(initiallyOpen);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                เปิดแบบฟอร์ม Routine
            </button>
            <RoutineTaskDialog
                open={open}
                intent="create"
                mode="SELF_SERVICE"
                reference={reference}
                task={null}
                isLoading={false}
                onRetry={vi.fn()}
                onClose={() => setOpen(false)}
                onSaved={() => {
                    onSaved();
                    setOpen(false);
                }}
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
