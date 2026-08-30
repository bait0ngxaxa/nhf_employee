import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    APPROVER_LEAVE_HISTORY_STATUSES,
} from "@/constants/leave";
import {
    LeaveHistoryFilters,
    type LeaveHistoryFiltersProps,
} from "@/components/dashboard/leave/_components/LeaveHistoryFilters";

function createProps(
    overrides: Partial<LeaveHistoryFiltersProps> = {},
): LeaveHistoryFiltersProps {
    return {
        query: "",
        queryPlaceholder: "ค้นหาชื่อพนักงาน...",
        queryLabel: "ค้นหาชื่อพนักงานในประวัติการพิจารณา",
        leaveType: "",
        status: "",
        year: "",
        yearOptions: [2026, 2025],
        statusOptions: APPROVER_LEAVE_HISTORY_STATUSES,
        hasActiveFilters: false,
        onQueryChange: vi.fn(),
        onLeaveTypeChange: vi.fn(),
        onStatusChange: vi.fn(),
        onYearChange: vi.fn(),
        onReset: vi.fn(),
        ...overrides,
    };
}

describe("LeaveHistoryFilters", () => {
    beforeEach(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    it("renders an accessible search control and three filter selects", () => {
        render(<LeaveHistoryFilters {...createProps()} />);

        expect(
            screen.getByRole("searchbox", {
                name: "ค้นหาชื่อพนักงานในประวัติการพิจารณา",
            }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole("combobox")).toHaveLength(3);
        expect(screen.getByRole("combobox", { name: "ประเภทการลา" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "สถานะการลา" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "ปีที่ลา" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ล้างตัวกรอง" })).toBeDisabled();
    });

    it("renders only the years supplied by the authorized history metadata", () => {
        render(<LeaveHistoryFilters {...createProps({ yearOptions: [2026, 2024] })} />);

        fireEvent.click(screen.getByRole("combobox", { name: "ปีที่ลา" }));

        expect(screen.getByRole("option", { name: "2569" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "2567" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "2543" })).not.toBeInTheDocument();
    });

    it("forwards search and select changes, and resets active filters", () => {
        const props = createProps({ hasActiveFilters: true });
        const { rerender } = render(<LeaveHistoryFilters {...props} />);

        fireEvent.change(
            screen.getByRole("searchbox", {
                name: "ค้นหาชื่อพนักงานในประวัติการพิจารณา",
            }),
            { target: { value: "สมชาย" } },
        );
        expect(props.onQueryChange).toHaveBeenCalledWith("สมชาย");

        fireEvent.click(screen.getByRole("combobox", { name: "ประเภทการลา" }));
        fireEvent.click(screen.getByRole("option", { name: "ลาป่วย" }));
        expect(props.onLeaveTypeChange).toHaveBeenCalledWith("SICK");

        fireEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
        expect(props.onReset).toHaveBeenCalledTimes(1);

        rerender(
            <LeaveHistoryFilters
                {...createProps({ query: "สมชาย", hasActiveFilters: true })}
            />,
        );
        expect(screen.getByRole("searchbox")).toHaveValue("สมชาย");
    });
});
