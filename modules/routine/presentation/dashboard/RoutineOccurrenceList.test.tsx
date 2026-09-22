import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { KeyedMutator } from "swr";

import { RoutineOccurrenceList } from "./RoutineOccurrenceList";
import { RoutineOccurrenceEditDialog } from "./RoutineOccurrenceEditDialog";
import type { RoutinePresentationCapabilities } from "../../application/types";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    RoutineEmployee,
} from "./types";

const allRoutineCapabilities = {
    canReadTasks: true,
    canReadAllTasks: true,
    canCreateTasks: true,
    canCreateTasksForOthers: true,
    canUpdateTasks: true,
    canUpdateAllTasks: true,
    canDeleteTasks: true,
    canDeleteAllTasks: true,
    canReadOccurrences: true,
    canOverrideOccurrences: true,
    canReassignOccurrences: true,
    canChangeOccurrenceDueDate: true,
    canManageImports: true,
    canExportTasks: true,
    canReadSummary: true,
    canReadAllSummary: true,
    canReadReference: true,
    canReadAllReferences: true,
} satisfies RoutinePresentationCapabilities;

const taskData: PaginatedRoutineTaskWorkItemsResponse = {
    tasks: [{
        canEdit: false,
        canDelete: false,
        id: 71,
        title: "ตรวจสอบระบบประจำเดือน",
        description: "ตรวจรายการระบบทั้งหมดและสรุปผลให้ทีมบริหาร",
        scheduleType: "MONTHLY_DAY",
        scheduleConfig: { day: 10, monthOffset: 0 },
        scheduleText: "ตรวจทุกวันที่ 10 ของเดือน",
        contractStartDate: "2026-01-01",
        contractEndDate: "2026-12-31",
        contractText: "สัญญาบำรุงรักษาระบบประจำปี 2569",
        extraDetails: "ประสานผู้ให้บริการก่อนเข้าตรวจอย่างน้อย 2 วัน",
        businessDayPolicy: "NONE",
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
        }, {
            employeeId: 22,
            role: "CO_OWNER",
            employee: {
                id: 22,
                firstName: "สมหญิง",
                lastName: "ใจงาม",
                nickname: null,
                displayName: "สมหญิง ใจงาม",
            },
        }],
        reminderRules: [{
            id: 301,
            daysBefore: 3,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: "ASSIGNEES",
            isActive: true,
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
            }, {
                employeeId: 22,
                role: "CO_OWNER",
                employee: {
                    id: 22,
                    firstName: "สมหญิง",
                    lastName: "ใจงาม",
                    nickname: null,
                    displayName: "สมหญิง ใจงาม",
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
}, {
    id: 22,
    firstName: "สมหญิง",
    lastName: "ใจงาม",
    nickname: null,
}];

interface RenderListOptions {
    data?: PaginatedRoutineTaskWorkItemsResponse;
    focusOccurrenceId?: number | null;
    canReadImportMetadata?: boolean;
    mutate?: KeyedMutator<PaginatedRoutineTaskWorkItemsResponse>;
    onEditTask?: (taskId: number) => void;
    routineCapabilities?: RoutinePresentationCapabilities;
}

function renderList({
    data = taskData,
    focusOccurrenceId = null,
    canReadImportMetadata = false,
    mutate = vi.fn(async () => undefined),
    onEditTask = vi.fn<(taskId: number) => void>(),
    routineCapabilities = {
        ...allRoutineCapabilities,
        canUpdateTasks: false,
        canOverrideOccurrences: false,
    },
}: RenderListOptions = {}): void {
    render(
        <RoutineOccurrenceList
            data={data}
            error={undefined}
            isLoading={false}
            canReadImportMetadata={canReadImportMetadata}
            focusTaskId={null}
            focusOccurrenceId={focusOccurrenceId}
            onRetry={vi.fn()}
            onPageChange={vi.fn()}
            onEditTask={onEditTask}
            mutate={mutate}
            routineCapabilities={routineCapabilities}
            employees={employees}
        />,
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("RoutineOccurrenceList", () => {
    it("keeps operational cards compact while showing scan-critical metadata", () => {
        renderList();

        const card = screen.getByRole("article");
        expect(card).toHaveTextContent("ตรวจสอบระบบประจำเดือน");
        expect(card).toHaveTextContent("มสช.");
        expect(card).toHaveTextContent("ระบบคอมพิวเตอร์");
        expect(card).toHaveTextContent("ถึงกำหนดวันนี้");
        expect(card).toHaveTextContent("วันนี้");
        expect(card).toHaveTextContent("วันที่ 10 ของเดือน");
        expect(card).toHaveTextContent("สมชาย ใจดี +1 คน");
        expect(card).not.toHaveTextContent("ตรวจรายการระบบทั้งหมดและสรุปผลให้ทีมบริหาร");
        expect(card).not.toHaveTextContent("สัญญาบำรุงรักษาระบบประจำปี 2569");
        expect(card).not.toHaveTextContent("ประสานผู้ให้บริการก่อนเข้าตรวจอย่างน้อย 2 วัน");
        expect(screen.getByRole("button", { name: "ดูรายละเอียด" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "แก้ไข Routine" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ปรับเฉพาะรอบนี้" })).not.toBeInTheDocument();
    });

    it("opens a read-only detail dialog with complete business information", () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        renderList();

        fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));

        const dialog = screen.getByRole("dialog", { name: "ตรวจสอบระบบประจำเดือน" });
        expect(dialog).toHaveTextContent("ตรวจรายการระบบทั้งหมดและสรุปผลให้ทีมบริหาร");
        expect(dialog).toHaveTextContent("สัญญาบำรุงรักษาระบบประจำปี 2569");
        expect(dialog).toHaveTextContent("ประสานผู้ให้บริการก่อนเข้าตรวจอย่างน้อย 2 วัน");
        expect(dialog).toHaveTextContent("3 วันก่อนครบกำหนด · 09:00 น.");
        expect(dialog).toHaveTextContent("รอบ 2026-08");
        expect(dialog).toHaveTextContent("สมหญิง ใจงาม");
        expect(dialog).not.toHaveTextContent("ข้อมูลต้นทางการนำเข้า");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("renders the neutral no-current-round state without inventing completion", () => {
        const baseTask = taskData.tasks[0];
        if (!baseTask) throw new Error("Routine test fixture is incomplete");
        const data: PaginatedRoutineTaskWorkItemsResponse = {
            ...taskData,
            tasks: [{ ...baseTask, relevantOccurrence: null }],
        };

        renderList({ data });

        expect(screen.getByRole("article")).toHaveTextContent("ยังไม่มีรอบกำหนด");
        expect(screen.queryByText("เสร็จสิ้น")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));
        expect(screen.getByRole("dialog")).toHaveTextContent(
            "ยังไม่มีรอบกำหนดที่เกี่ยวข้องในขณะนี้",
        );
    });

    it("separates task edit from the occurrence-only override", () => {
        const onEditTask = vi.fn();
        const adminData: PaginatedRoutineTaskWorkItemsResponse = {
            ...taskData,
            tasks: [{ ...taskData.tasks[0], canEdit: true, canDelete: true }],
        };
        renderList({
            data: adminData,
            canReadImportMetadata: true,
            onEditTask,
            routineCapabilities: allRoutineCapabilities,
        });

        expect(screen.getByRole("button", { name: "ดูรายละเอียด" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "แก้ไข Routine" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));
        expect(onEditTask).toHaveBeenCalledWith(71);
    });

    it("shows master edit to an assigned employee without occurrence administration", () => {
        const onEditTask = vi.fn();
        const assignedData: PaginatedRoutineTaskWorkItemsResponse = {
            ...taskData,
            tasks: [{ ...taskData.tasks[0], canEdit: true, canDelete: false }],
        };

        renderList({
            data: assignedData,
            onEditTask,
            routineCapabilities: {
                ...allRoutineCapabilities,
                canOverrideOccurrences: false,
            },
        });

        expect(screen.getByRole("button", { name: "ดูรายละเอียด" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "แก้ไข Routine" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ปรับเฉพาะรอบนี้" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));
        expect(onEditTask).toHaveBeenCalledWith(71);
    });

    it("opens occurrence editing in a prefilled dialog and cancel does not mutate", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        renderList({
            canReadImportMetadata: true,
            routineCapabilities: {
                ...allRoutineCapabilities,
                canUpdateTasks: false,
            },
        });

        fireEvent.click(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" }));

        const dialog = screen.getByRole("dialog", { name: "ปรับเฉพาะรอบนี้" });
        expect(within(dialog).getByLabelText("วันกำหนด")).toHaveValue("2026-08-04");
        expect(within(dialog).getByLabelText("บทบาทของ สมชาย ใจดี")).toHaveValue("OWNER");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยกเลิก" }));

        await waitFor(() => expect(screen.queryByRole("dialog", { name: "ปรับเฉพาะรอบนี้" })).not.toBeInTheDocument());
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not resurrect an occurrence editor after override capability loss", () => {
        function CapabilityHarness() {
            const [canOverrideOccurrences, setCanOverrideOccurrences] = useState(true);

            return (
                <>
                    <button
                        type="button"
                        onClick={() => setCanOverrideOccurrences(false)}
                    >
                        ถอนสิทธิ์ปรับรอบ
                    </button>
                    <button
                        type="button"
                        onClick={() => setCanOverrideOccurrences(true)}
                    >
                        คืนสิทธิ์ปรับรอบ
                    </button>
                    <RoutineOccurrenceList
                        data={taskData}
                        error={undefined}
                        isLoading={false}
                        canReadImportMetadata={false}
                        focusTaskId={null}
                        focusOccurrenceId={null}
                        onRetry={vi.fn()}
                        onPageChange={vi.fn()}
                        onEditTask={vi.fn()}
                        mutate={vi.fn(async () => undefined)}
                        routineCapabilities={{
                            ...allRoutineCapabilities,
                            canUpdateTasks: false,
                            canOverrideOccurrences,
                        }}
                        employees={employees}
                    />
                </>
            );
        }

        render(<CapabilityHarness />);
        fireEvent.click(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" }));
        expect(screen.getByRole("dialog", { name: "ปรับเฉพาะรอบนี้" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {
            name: "ถอนสิทธิ์ปรับรอบ",
            hidden: true,
        }));
        expect(screen.queryByRole("dialog", { name: "ปรับเฉพาะรอบนี้" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "คืนสิทธิ์ปรับรอบ" }));
        expect(screen.queryByRole("dialog", { name: "ปรับเฉพาะรอบนี้" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" }));
        expect(screen.getByRole("dialog", { name: "ปรับเฉพาะรอบนี้" })).toBeInTheDocument();
    });

    it("saves an occurrence override with the existing atomic mutation and refreshes", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ occurrence: { id: 91 } }), { status: 200 }),
        );
        const mutate = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("fetch", fetchMock);
        renderList({
            canReadImportMetadata: true,
            mutate,
            routineCapabilities: {
                ...allRoutineCapabilities,
                canUpdateTasks: false,
            },
        });

        fireEvent.click(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" }));
        const dialog = screen.getByRole("dialog", { name: "ปรับเฉพาะรอบนี้" });
        fireEvent.change(within(dialog).getByLabelText("วันกำหนด"), {
            target: { value: "2026-08-10" },
        });
        fireEvent.change(within(dialog).getByLabelText("หมายเหตุ (ถ้ามี)"), {
            target: { value: "เลื่อนตามการประชุม" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "บันทึกการปรับรอบนี้" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/routines/occurrences/91",
            expect.objectContaining({ method: "PATCH" }),
        );
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(JSON.parse(String(request.body))).toMatchObject({
            expectedReminderVersion: 1,
            dueDate: "2026-08-10",
            note: "เลื่อนตามการประชุม",
        });
        await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "ปรับเฉพาะรอบนี้" })).not.toBeInTheDocument());
    });

    it("keeps the occurrence draft and session-start reminder version across same-ID refreshes", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ occurrence: { id: 91 } }), { status: 200 }),
        );
        const onSaved = vi.fn(async () => undefined);
        const onOpenChange = vi.fn();
        const task = taskData.tasks[0];
        if (!task || !task.relevantOccurrence) throw new Error("Routine test fixture is incomplete");
        vi.stubGlobal("fetch", fetchMock);

        const view = render(
            <RoutineOccurrenceEditDialog
                task={task}
                open
                canOverrideOccurrences
                employees={employees}
                onOpenChange={onOpenChange}
                onSaved={onSaved}
            />,
        );
        const dialog = screen.getByRole("dialog", { name: "ปรับเฉพาะรอบนี้" });
        fireEvent.change(within(dialog).getByLabelText("วันกำหนด"), { target: { value: "2026-08-10" } });
        fireEvent.change(within(dialog).getByLabelText("หมายเหตุ (ถ้ามี)"), { target: { value: "แก้เฉพาะ session นี้" } });

        const refreshedTask = {
            ...task,
            relevantOccurrence: {
                ...task.relevantOccurrence,
                dueDate: "2026-09-01",
                reminderVersion: 2,
            },
        };
        view.rerender(
            <RoutineOccurrenceEditDialog
                task={refreshedTask}
                open
                canOverrideOccurrences
                employees={employees}
                onOpenChange={onOpenChange}
                onSaved={onSaved}
            />,
        );

        expect(screen.getByLabelText("วันกำหนด")).toHaveValue("2026-08-10");
        expect(screen.getByLabelText("หมายเหตุ (ถ้ามี)")).toHaveValue("แก้เฉพาะ session นี้");
        fireEvent.click(screen.getByRole("button", { name: "บันทึกการปรับรอบนี้" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(JSON.parse(String(request.body))).toMatchObject({
            expectedReminderVersion: 1,
            dueDate: "2026-08-10",
            note: "แก้เฉพาะ session นี้",
        });
        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("starts a fresh occurrence editor after close and when the occurrence identity changes", () => {
        const onOpenChange = vi.fn();
        const task = taskData.tasks[0];
        if (!task || !task.relevantOccurrence) throw new Error("Routine test fixture is incomplete");

        const view = render(
            <RoutineOccurrenceEditDialog
                task={task}
                open
                canOverrideOccurrences
                employees={employees}
                onOpenChange={onOpenChange}
                onSaved={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByLabelText("วันกำหนด"), { target: { value: "2026-08-11" } });
        view.rerender(
            <RoutineOccurrenceEditDialog
                task={task}
                open={false}
                canOverrideOccurrences
                employees={employees}
                onOpenChange={onOpenChange}
                onSaved={vi.fn()}
            />,
        );
        view.rerender(
            <RoutineOccurrenceEditDialog
                task={{ ...task, relevantOccurrence: { ...task.relevantOccurrence, dueDate: "2026-08-12" } }}
                open
                canOverrideOccurrences
                employees={employees}
                onOpenChange={onOpenChange}
                onSaved={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("วันกำหนด")).toHaveValue("2026-08-12");

        view.rerender(
            <RoutineOccurrenceEditDialog
                task={{ ...task, relevantOccurrence: { ...task.relevantOccurrence, id: 92, dueDate: "2026-08-20" } }}
                open
                canOverrideOccurrences
                employees={employees}
                onOpenChange={onOpenChange}
                onSaved={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("วันกำหนด")).toHaveValue("2026-08-20");
    });

    it("distinguishes occurrence assignee overrides from the master Routine", () => {
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

        renderList({ data: overriddenData, focusOccurrenceId: 91 });

        const card = screen.getByRole("article");
        expect(card).toHaveTextContent("ผู้รับผิดชอบรอบนี้");
        expect(card).toHaveTextContent("มานะ ดีใจ");
        expect(card).toHaveTextContent("ปรับเฉพาะรอบ");
        expect(card).toHaveTextContent("รอบที่เลือก");

        fireEvent.click(screen.getByRole("button", { name: "ดูรายละเอียด" }));
        const dialog = screen.getByRole("dialog", { name: "ตรวจสอบระบบประจำเดือน" });
        expect(dialog).toHaveTextContent("ผู้รับผิดชอบรอบนี้");
        expect(dialog).toHaveTextContent("ผู้รับผิดชอบแม่แบบ Routine");
        expect(dialog).toHaveTextContent("มานะ ดีใจ");
        expect(dialog).toHaveTextContent("สมชาย ใจดี");
    });

    it("shows task and occurrence actions to a non-admin actor with explicit grants", () => {
        const onEditTask = vi.fn();
        renderList({
            data: {
                ...taskData,
                tasks: [{ ...taskData.tasks[0], canEdit: true, canDelete: true }],
            },
            canReadImportMetadata: false,
            onEditTask,
            routineCapabilities: allRoutineCapabilities,
        });

        expect(screen.getByRole("button", { name: "แก้ไข Routine" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ปรับเฉพาะรอบนี้" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));
        expect(onEditTask).toHaveBeenCalledWith(71);
    });
});
