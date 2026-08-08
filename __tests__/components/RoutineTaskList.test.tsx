import { fireEvent, render, screen, within } from "@testing-library/react";
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
        isLoading: false,
        onRetry: vi.fn(),
        onCreate: vi.fn(),
        onEdit: vi.fn(),
        onToggleActive: vi.fn(async () => undefined),
        onDelete: vi.fn(async () => undefined),
        pendingTaskId: null,
        onPageChange: vi.fn(),
        units: [{ id: 1, code: "มสช.", name: "มสช." }],
        search: "",
        unitId: "",
        status: "" as const,
        onSearchChange: vi.fn(),
        onUnitChange: vi.fn(),
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

    it("exposes labelled search and status filters and separates filtered empty state", () => {
        const props = makeProps();
        const { rerender } = render(
            <RoutineTaskList {...props} data={{ ...props.data, tasks: [] }} />,
        );

        expect(screen.getByRole("searchbox", { name: "ค้นหาแม่แบบงาน" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "หน่วยงาน" })).toHaveValue("");
        expect(screen.getByRole("combobox", { name: "สถานะ" })).toHaveValue("");
        expect(screen.getByRole("option", { name: "ใช้งาน" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "ปิดใช้งาน" })).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("ยังไม่มีแม่แบบงานประจำ");
        expect(within(screen.getByRole("status")).queryByRole("button", { name: "สร้างแม่แบบงาน" })).not.toBeInTheDocument();

        rerender(
            <RoutineTaskList
                {...props}
                data={{ ...props.data, tasks: [] }}
                search="ไม่มีรายการนี้"
            />,
        );

        expect(screen.getByRole("status")).toHaveTextContent("ไม่พบแม่แบบงานที่ตรงกับตัวกรอง");
        expect(screen.getByRole("status")).toHaveTextContent("ลองเปลี่ยนคำค้นหาหรือตัวกรอง");
    });

    it("keeps the task action column sticky and its edit action clickable", () => {
        const props = makeProps();
        const { container } = render(<RoutineTaskList {...props} />);

        const actionCell = container.querySelector("tbody td.sticky");
        expect(actionCell).toHaveClass("right-0", "bg-surface-raised", "employee-table-sticky-shadow");

        fireEvent.click(screen.getByRole("button", { name: "แก้ไข" }));
        expect(props.onEdit).toHaveBeenCalledWith(task);
    });
});
