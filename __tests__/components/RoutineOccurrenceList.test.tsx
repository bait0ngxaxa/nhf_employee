import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { KeyedMutator } from "swr";

import { RoutineOccurrenceList } from "@/components/dashboard/routine/RoutineOccurrenceList";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    RoutineEmployee,
} from "@/components/dashboard/routine/types";

const taskData: PaginatedRoutineTaskWorkItemsResponse = {
    tasks: [{
        id: 71,
        title: "ตรวจสอบระบบประจำเดือน",
        description: null,
        scheduleType: "MONTHLY_DAY",
        scheduleText: null,
        isActive: true,
        unit: { id: 1, code: "มสช.", name: "มสช." },
        category: { id: 1, name: "ระบบคอมพิวเตอร์" },
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
        relevantOccurrence: {
            id: 91,
            taskId: 71,
            periodKey: "2026-08",
            dueDate: "2026-08-04",
            originalDueDate: "2026-08-04",
            scheduleVersion: 1,
            reminderVersion: 1,
            timingStatus: "DUE_TODAY",
            isOverdue: false,
            daysUntilDue: 0,
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
        },
    }],
    pagination: { page: 1, limit: 20, total: 1, pages: 1 },
};

const employees: RoutineEmployee[] = [{
    id: 21,
    firstName: "สมชาย",
    lastName: "ใจดี",
    nickname: null,
}];

function renderList(
    isAdmin: boolean,
    onEditTask = vi.fn(),
    data = taskData,
    focusOccurrenceId: number | null = null,
): void {
    render(
        <RoutineOccurrenceList
            data={data}
            error={undefined}
            isLoading={false}
            isAdmin={isAdmin}
            focusTaskId={null}
            focusOccurrenceId={focusOccurrenceId}
            onRetry={vi.fn()}
            onPageChange={vi.fn()}
            onEditTask={onEditTask}
            mutate={vi.fn() as unknown as KeyedMutator<PaginatedRoutineTaskWorkItemsResponse>}
            employees={employees}
        />,
    );
}

describe("RoutineOccurrenceList", () => {
    it("renders a read-only task-centric timing list for regular users", () => {
        renderList(false);

        expect(screen.getByText("ถึงกำหนดวันนี้")).toBeInTheDocument();
        expect(screen.getByRole("article")).toHaveTextContent("วันนี้");
        expect(screen.queryByText("แก้ไข Routine")).not.toBeInTheDocument();
        expect(screen.queryByText("ปรับเฉพาะรอบนี้")).not.toBeInTheDocument();
    });

    it("separates primary Task edit from the occurrence-only override", () => {
        renderList(true);

        expect(screen.getByRole("button", { name: "แก้ไข Routine" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" })).toBeInTheDocument();
    });

    it("passes the Task id to the primary edit action", () => {
        const onEditTask = vi.fn();
        renderList(true, onEditTask);

        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));

        expect(onEditTask).toHaveBeenCalledWith(71);
    });

    it("does not call an occurrence endpoint for primary Task edit", () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const onEditTask = vi.fn();
        renderList(true, onEditTask);

        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));

        expect(onEditTask).toHaveBeenCalledWith(71);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("saves an occurrence override with one atomic endpoint", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ occurrence: { id: 91 } }), { status: 200 }),
        );
        vi.stubGlobal("fetch", fetchMock);
        renderList(true);

        fireEvent.click(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" }));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกการปรับรอบนี้" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/routines/occurrences/91",
            expect.objectContaining({ method: "PATCH" }),
        );
        expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("expectedReminderVersion");
    });

    it("shows occurrence assignees separately in a focused notification view", () => {
        const baseTask = taskData.tasks[0];
        if (!baseTask || !baseTask.relevantOccurrence) {
            throw new Error("Routine test fixture is incomplete");
        }
        const focusedData: PaginatedRoutineTaskWorkItemsResponse = {
            ...taskData,
            tasks: [{
                ...baseTask,
                relevantOccurrence: {
                    ...baseTask.relevantOccurrence,
                    assignees: [{
                        employeeId: 42,
                        role: "OWNER",
                        employee: {
                            id: 42,
                            firstName: "มานะ",
                            lastName: "ดีใจ",
                            nickname: null,
                            displayName: "มานะ ดีใจ",
                        },
                    }],
                },
            }],
        };

        renderList(false, vi.fn(), focusedData, 91);

        expect(screen.getByText(/ผู้รับผิดชอบรอบนี้:/)).toHaveTextContent("มานะ ดีใจ");
        expect(screen.getByText(/ผู้รับผิดชอบ Routine:/)).toHaveTextContent("สมชาย ใจดี");
    });

    it("indicates an occurrence-only assignee override in the regular list", () => {
        const baseTask = taskData.tasks[0];
        if (!baseTask || !baseTask.relevantOccurrence) {
            throw new Error("Routine test fixture is incomplete");
        }
        const overriddenData: PaginatedRoutineTaskWorkItemsResponse = {
            ...taskData,
            tasks: [{
                ...baseTask,
                relevantOccurrence: {
                    ...baseTask.relevantOccurrence,
                    assignees: [{
                        employeeId: 42,
                        role: "OWNER",
                        employee: {
                            id: 42,
                            firstName: "มานะ",
                            lastName: "ดีใจ",
                            nickname: null,
                            displayName: "มานะ ดีใจ",
                        },
                    }],
                },
            }],
        };

        renderList(false, vi.fn(), overriddenData);

        expect(screen.getByText("รอบนี้มีการปรับผู้รับผิดชอบเฉพาะกิจ")).toBeInTheDocument();
        expect(screen.getByText(/ผู้รับผิดชอบ Routine:/)).toHaveTextContent("สมชาย ใจดี");
    });
});
