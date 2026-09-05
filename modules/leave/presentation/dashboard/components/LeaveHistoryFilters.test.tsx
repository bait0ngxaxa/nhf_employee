import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APPROVER_LEAVE_HISTORY_STATUSES } from "../../../domain/constants";
import {
    LeaveHistoryFilters,
    type LeaveHistoryFiltersProps,
} from "./LeaveHistoryFilters";

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
        expect(screen.getByRole("combobox", { name: "ประเภทการลา" })).toHaveTextContent("ทุกประเภท");
        expect(screen.getByRole("combobox", { name: "สถานะการลา" })).toHaveTextContent("ทุกสถานะ");
        expect(screen.getByRole("combobox", { name: "ปีที่ลา" })).toHaveTextContent("ทุกปี");
        expect(screen.getByRole("button", { name: "ล้างตัวกรอง" })).toBeDisabled();
    });

    it("renders only the years supplied by the authorized history metadata", () => {
        render(<LeaveHistoryFilters {...createProps({ yearOptions: [2026, 2024] })} />);

        fireEvent.click(screen.getByRole("combobox", { name: "ปีที่ลา" }));

        expect(screen.getByRole("option", { name: "2569" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "2567" })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "2543" })).not.toBeInTheDocument();
    });

    it("clears only the leave type when selecting all types", () => {
        const props = createProps({
            leaveType: "SICK",
            status: "APPROVED",
            year: "2026",
            hasActiveFilters: true,
        });
        render(<LeaveHistoryFilters {...props} />);

        fireEvent.click(screen.getByRole("combobox", { name: "ประเภทการลา" }));
        fireEvent.click(screen.getByRole("option", { name: "ทุกประเภท" }));

        expect(props.onLeaveTypeChange).toHaveBeenCalledWith("");
        expect(props.onStatusChange).not.toHaveBeenCalled();
        expect(props.onYearChange).not.toHaveBeenCalled();
    });

    it("clears only the status when selecting all statuses", () => {
        const props = createProps({
            leaveType: "SICK",
            status: "APPROVED",
            year: "2026",
            hasActiveFilters: true,
        });
        render(<LeaveHistoryFilters {...props} />);

        fireEvent.click(screen.getByRole("combobox", { name: "สถานะการลา" }));
        fireEvent.click(screen.getByRole("option", { name: "ทุกสถานะ" }));

        expect(props.onStatusChange).toHaveBeenCalledWith("");
        expect(props.onLeaveTypeChange).not.toHaveBeenCalled();
        expect(props.onYearChange).not.toHaveBeenCalled();
    });

    it("clears only the year when selecting all years", () => {
        const props = createProps({
            leaveType: "SICK",
            status: "APPROVED",
            year: "2026",
            hasActiveFilters: true,
        });
        render(<LeaveHistoryFilters {...props} />);

        fireEvent.click(screen.getByRole("combobox", { name: "ปีที่ลา" }));
        fireEvent.click(screen.getByRole("option", { name: "ทุกปี" }));

        expect(props.onYearChange).toHaveBeenCalledWith("");
        expect(props.onLeaveTypeChange).not.toHaveBeenCalled();
        expect(props.onStatusChange).not.toHaveBeenCalled();
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
