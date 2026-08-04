import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KeyedMutator } from "swr";

import { RoutineOccurrenceList } from "@/components/dashboard/routine/RoutineOccurrenceList";
import type {
    PaginatedOccurrencesResponse,
    RoutineEmployee,
} from "@/components/dashboard/routine/types";

const occurrenceData: PaginatedOccurrencesResponse = {
    occurrences: [{
        id: 91,
        taskId: 71,
        periodKey: "2026-08",
        dueDate: "2026-08-04",
        originalDueDate: "2026-08-04",
        scheduleVersion: 1,
        reminderVersion: 1,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        timingStatus: "DUE_TODAY",
        isOverdue: false,
        daysUntilDue: 0,
        task: {
            id: 71,
            title: "ตรวจสอบระบบประจำเดือน",
            description: null,
            scheduleType: "MONTHLY_DAY",
            scheduleText: null,
            unit: { id: 1, code: "มสช.", name: "มสช." },
            category: { id: 1, name: "ระบบคอมพิวเตอร์" },
        },
        assignees: [{
            employeeId: 21,
            role: "OWNER",
            employee: {
                id: 21,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                displayName: "สมชาย ใจดี",
            },
        }],
    }],
    pagination: { page: 1, limit: 20, total: 1, pages: 1 },
};

const employees: RoutineEmployee[] = [{
    id: 21,
    firstName: "สมชาย",
    lastName: "ใจดี",
    nickname: null,
}];

function renderList(isAdmin: boolean): void {
    render(
        <RoutineOccurrenceList
            data={occurrenceData}
            error={undefined}
            isLoading={false}
            isAdmin={isAdmin}
            onRetry={vi.fn()}
            onPageChange={vi.fn()}
            mutate={vi.fn() as unknown as KeyedMutator<PaginatedOccurrencesResponse>}
            employees={employees}
        />,
    );
}

describe("RoutineOccurrenceList", () => {
    it("renders a read-only timing list for regular users", () => {
        renderList(false);

        expect(screen.getByText("ถึงกำหนดวันนี้")).toBeInTheDocument();
        expect(screen.getByRole("article")).toHaveTextContent("วันนี้");
        expect(screen.queryByText("เริ่มงาน")).not.toBeInTheDocument();
        expect(screen.queryByText("ปิดงาน")).not.toBeInTheDocument();
        expect(screen.queryByText("ข้ามงาน")).not.toBeInTheDocument();
        expect(screen.queryByText("ยกเลิกงาน")).not.toBeInTheDocument();
        expect(screen.queryByText("เปิดงานอีกครั้ง")).not.toBeInTheDocument();
        expect(screen.queryByText("completion note")).not.toBeInTheDocument();
    });

    it("exposes only the admin schedule and assignee editor", () => {
        renderList(true);

        expect(screen.getByRole("button", { name: "แก้ไขรายการ" })).toBeInTheDocument();
        expect(screen.queryByText("เริ่มงาน")).not.toBeInTheDocument();
        expect(screen.queryByText("ปิดงาน")).not.toBeInTheDocument();
    });
});
