import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoutineTaskList } from "@/components/dashboard/routine/RoutineTaskList";
import type { RoutineTask } from "@/components/dashboard/routine/types";

const task = {
    id: 71,
    unitId: 1,
    categoryId: 1,
    title: "ตรวจสอบระบบ",
    description: "ตรวจสอบรายการประจำเดือน",
    scheduleType: "MONTHLY_DAY",
    scheduleConfig: { day: 10 },
    scheduleText: "ทุกเดือน",
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
    assignees: [],
    reminderRules: [],
    _count: { occurrences: 1 },
} satisfies RoutineTask;

function makeProps() {
    return {
        data: {
            tasks: [task],
            pagination: { page: 1, limit: 20, total: 1, pages: 1 },
        },
        error: undefined,
        isAdmin: true,
        isLoading: false,
        onRetry: vi.fn(),
        onCreate: vi.fn(),
        onEdit: vi.fn(),
        onToggleActive: vi.fn(async () => undefined),
        onDelete: vi.fn(async () => undefined),
        pendingTaskId: null,
        onPageChange: vi.fn(),
        units: [{ id: 1, code: "มสช.", name: "มสช." }],
        categories: [
            { id: 1, name: "ระบบคอมพิวเตอร์" },
            { id: 2, name: "รายงานประจำเดือน" },
        ],
        search: "",
        unitId: "",
        categoryId: "",
        status: "" as const,
        onSearchChange: vi.fn(),
        onUnitChange: vi.fn(),
        onCategoryChange: vi.fn(),
        onStatusChange: vi.fn(),
    };
}

describe("RoutineTaskList", () => {
    it("shows the standard clear-search action only when search has a value", () => {
        const props = makeProps();
        const { rerender } = render(<RoutineTaskList {...props} />);

        expect(
            screen.queryByRole("button", { name: "ล้างคำค้นหาแม่แบบงาน" }),
        ).not.toBeInTheDocument();

        rerender(<RoutineTaskList {...props} search="ตรวจสอบ" />);
        fireEvent.click(
            screen.getByRole("button", { name: "ล้างคำค้นหาแม่แบบงาน" }),
        );

        expect(props.onSearchChange).toHaveBeenCalledWith("");
    });

    it("exposes labelled unit, category, and status filters and separates filtered empty state", () => {
        const props = makeProps();
        const { rerender } = render(
            <RoutineTaskList {...props} data={{ ...props.data, tasks: [] }} />,
        );

        expect(screen.getByRole("searchbox", { name: "ค้นหาแม่แบบงาน" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "หน่วยงาน" })).toHaveValue("");
        expect(screen.getByRole("combobox", { name: "หมวดหมู่งาน" })).toHaveValue("");
        expect(screen.getByRole("combobox", { name: "สถานะ" })).toHaveValue("");
        expect(screen.getByRole("option", { name: "รายงานประจำเดือน" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "ใช้งาน" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "ปิดใช้งาน" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("ยังไม่มีแม่แบบงานประจำ");
        expect(within(screen.getByRole("status")).queryByRole("button", { name: "สร้างแม่แบบงาน" })).not.toBeInTheDocument();

        fireEvent.change(screen.getByRole("combobox", { name: "หมวดหมู่งาน" }), {
            target: { value: "2" },
        });
        expect(props.onCategoryChange).toHaveBeenCalledWith("2");

        rerender(
            <RoutineTaskList
                {...props}
                data={{ ...props.data, tasks: [] }}
                categoryId="2"
            />,
        );

        expect(screen.getByRole("status")).toHaveTextContent("ไม่พบแม่แบบงานที่ตรงกับตัวกรอง");
        expect(screen.getByRole("status")).toHaveTextContent("ลองเปลี่ยนคำค้นหาหรือตัวกรอง");
    });

    it("keeps the task action column sticky and exposes detail and edit actions", () => {
        const props = makeProps();
        const { container } = render(<RoutineTaskList {...props} />);

        const actionCell = container.querySelector("tbody td:last-child");
        expect(actionCell).toHaveClass("lg:sticky", "lg:right-0", "bg-surface-raised");

        fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));
        expect(screen.getByRole("dialog", { name: "ตรวจสอบระบบ" })).toHaveTextContent(
            "ตรวจสอบรายการประจำเดือน",
        );
        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));

        fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));
        expect(props.onEdit).toHaveBeenCalledWith(task);
    });

    it("reflows task details without a forced-width table on mobile", () => {
        const props = makeProps();
        const { container } = render(<RoutineTaskList {...props} />);

        const table = screen.getByRole("table");
        expect(table).toHaveClass("block", "lg:table", "lg:min-w-[900px]");
        expect(table).not.toHaveClass("min-w-[900px]");
        expect(container.querySelector("thead")).toHaveClass("hidden", "lg:table-header-group");
        expect(screen.getByText("หน่วยงาน", { selector: "td span" })).toHaveClass("lg:hidden");
        expect(screen.getByText("ยังไม่ได้ระบุ")).toBeInTheDocument();
    });

    it("keeps long detail fields out of the management row", () => {
        const props = makeProps();
        render(<RoutineTaskList {...props} />);

        const row = screen.getByRole("row", { name: /ตรวจสอบระบบ/ });
        expect(row).toHaveTextContent("วันที่ 10 ของเดือน");
        expect(row).not.toHaveTextContent("ตรวจสอบรายการประจำเดือน");
        expect(row).not.toHaveTextContent("ทุกเดือน");
    });

    it("shows import metadata only in an admin detail dialog", () => {
        const importedTask: RoutineTask = {
            ...task,
            sourceFileName: "routine.xlsx",
            sourceSheet: "งานประจำ",
            sourceRow: 12,
        };
        const props = makeProps();
        const importedData = {
            ...props.data,
            tasks: [importedTask],
        };
        const { rerender } = render(
            <RoutineTaskList {...props} data={importedData} isAdmin={false} />,
        );

        fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));
        expect(screen.getByRole("dialog")).not.toHaveTextContent("ข้อมูลนำเข้า (ผู้ดูแลระบบ)");
        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));

        rerender(<RoutineTaskList {...props} data={importedData} isAdmin />);
        fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));
        expect(screen.getByRole("dialog")).toHaveTextContent("ข้อมูลนำเข้า (ผู้ดูแลระบบ)");
        expect(screen.getByRole("dialog")).toHaveTextContent("routine.xlsx");
    });

    it("retains activate/deactivate and delete management actions", async () => {
        const props = makeProps();
        render(<RoutineTaskList {...props} />);

        fireEvent.click(screen.getByRole("button", { name: "ปิดใช้งาน" }));
        expect(props.onToggleActive).toHaveBeenCalledWith(task);

        fireEvent.click(screen.getByRole("button", { name: "ลบ" }));
        expect(screen.getByRole("alertdialog", { name: "ยืนยันการลบ Routine" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ลบรายการ" }));

        await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(task));
    });
});
