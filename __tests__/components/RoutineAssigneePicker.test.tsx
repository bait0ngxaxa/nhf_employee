import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoutineAssigneePicker } from "@/components/dashboard/routine/RoutineAssigneePicker";
import type { RoutineEmployee } from "@/components/dashboard/routine/types";

const NOTIFICATION_WARNING = "บัญชียังไม่พร้อมใช้งาน · จะยังไม่ได้รับการแจ้งเตือน";

function employee(overrides: Partial<RoutineEmployee> = {}): RoutineEmployee {
    return {
        id: 11,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: null,
        status: "ACTIVE",
        deletedAt: null,
        notificationReady: true,
        ...overrides,
    };
}

describe("RoutineAssigneePicker notification readiness", () => {
    it("keeps an active employee without a User selectable and shows the warning in search and selection", () => {
        const onToggle = vi.fn();
        const employees = [employee({ notificationReady: false })];
        const { rerender } = render(
            <RoutineAssigneePicker
                employees={employees}
                assignees={{}}
                onToggle={onToggle}
                onRoleChange={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText("ค้นหาพนักงาน"), {
            target: { value: "สมชาย" },
        });
        const checkbox = screen.getByLabelText("เลือก สมชาย ใจดี");
        expect(checkbox).toBeEnabled();
        expect(screen.getByText(NOTIFICATION_WARNING)).toBeInTheDocument();

        fireEvent.click(checkbox);
        expect(onToggle).toHaveBeenCalledWith(11);

        rerender(
            <RoutineAssigneePicker
                employees={employees}
                assignees={{ 11: "OWNER" }}
                onToggle={onToggle}
                onRoleChange={vi.fn()}
            />,
        );
        expect(screen.getByText(NOTIFICATION_WARNING)).toBeInTheDocument();
    });

    it("keeps an active employee with an inactive User selectable and warns before selection", () => {
        render(
            <RoutineAssigneePicker
                employees={[employee({ id: 12, firstName: "สมหญิง", notificationReady: false })]}
                assignees={{}}
                onToggle={vi.fn()}
                onRoleChange={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText("ค้นหาพนักงาน"), {
            target: { value: "สมหญิง" },
        });

        expect(screen.getByLabelText("เลือก สมหญิง ใจดี")).toBeEnabled();
        expect(screen.getByText(NOTIFICATION_WARNING)).toBeInTheDocument();
    });

    it.each([
        ["inactive", employee({ status: "INACTIVE" }), "ไม่พร้อมใช้งาน · เลือกเพิ่มไม่ได้"],
        ["deleted", employee({ deletedAt: "2026-08-01T00:00:00.000Z" }), "ถูกลบแล้ว · เลือกเพิ่มไม่ได้"],
    ])("keeps an %s employee unavailable", (_state, unavailableEmployee, message) => {
        const onToggle = vi.fn();
        render(
            <RoutineAssigneePicker
                employees={[unavailableEmployee]}
                assignees={{}}
                onToggle={onToggle}
                onRoleChange={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText("ค้นหาพนักงาน"), {
            target: { value: "สมชาย" },
        });
        const checkbox = screen.getByLabelText("เลือก สมชาย ใจดี");
        expect(checkbox).toBeDisabled();
        expect(screen.getByText(message)).toBeInTheDocument();
        fireEvent.click(checkbox);
        expect(onToggle).not.toHaveBeenCalled();
    });

    it("does not show a notification warning for an active employee with an active User", () => {
        render(
            <RoutineAssigneePicker
                employees={[employee()]}
                assignees={{}}
                onToggle={vi.fn()}
                onRoleChange={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText("ค้นหาพนักงาน"), {
            target: { value: "สมชาย" },
        });

        expect(screen.getByLabelText("เลือก สมชาย ใจดี")).toBeEnabled();
        expect(screen.queryByText(NOTIFICATION_WARNING)).not.toBeInTheDocument();
    });
});
