import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    class MockLiffApiError extends Error {
        readonly status: number | undefined;
        readonly sessionRecovered: boolean;
        readonly unauthorizedRecovery: { recovered: boolean; replayed: boolean } | undefined;

        constructor(
            message: string,
            status?: number,
            unauthorizedRecovery?: { recovered: boolean; replayed: boolean },
        ) {
            super(message);
            this.name = "LiffApiError";
            this.status = status;
            this.sessionRecovered = unauthorizedRecovery?.recovered === true;
            this.unauthorizedRecovery = unauthorizedRecovery;
        }
    }

    return {
        useSearchParams: vi.fn(),
        fetchLiffRoutineSummary: vi.fn(),
        fetchLiffRoutineTasks: vi.fn(),
        fetchLiffRoutineReference: vi.fn(),
        fetchLiffRoutineTask: vi.fn(),
        createLiffRoutineTask: vi.fn(),
        updateLiffRoutineTask: vi.fn(),
        deleteLiffRoutineTask: vi.fn(),
        MockLiffApiError,
        isRecoveredLiffMutation: (error: unknown): boolean =>
            error instanceof MockLiffApiError
            && error.status === 401
            && error.sessionRecovered
            && error.unauthorizedRecovery?.replayed === false,
        LIFF_SESSION_RECOVERED_MUTATION_MESSAGE:
            "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว กรุณาตรวจสอบสถานะล่าสุดก่อนลองดำเนินการอีกครั้ง",
    };
});

vi.mock("next/navigation", () => ({
    useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/client/liff", () => ({
    LiffApiError: mocks.MockLiffApiError,
    isRecoveredLiffMutation: mocks.isRecoveredLiffMutation,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE:
        mocks.LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
}));

vi.mock("@/lib/client/liff-routine", () => ({
    fetchLiffRoutineSummary: mocks.fetchLiffRoutineSummary,
    fetchLiffRoutineTasks: mocks.fetchLiffRoutineTasks,
    fetchLiffRoutineReference: mocks.fetchLiffRoutineReference,
    fetchLiffRoutineTask: mocks.fetchLiffRoutineTask,
    createLiffRoutineTask: mocks.createLiffRoutineTask,
    updateLiffRoutineTask: mocks.updateLiffRoutineTask,
    deleteLiffRoutineTask: mocks.deleteLiffRoutineTask,
}));

import { LiffRoutineApp } from "@/components/liff/routine/LiffRoutineApp";
import type {
    LiffRoutineTaskDetail,
    LiffRoutineTaskWorkItem,
} from "@/lib/line/routine-types";

const SUMMARY = {
    summary: {
        today: 1,
        dueSoon: 2,
        within30Days: 3,
        asOfDate: "2026-08-10",
    },
};

const TASK: LiffRoutineTaskWorkItem = {
    id: 71,
    title: "ตรวจสอบระบบ",
    description: "ตรวจสอบอุปกรณ์ประจำเดือน",
    scheduleType: "MANUAL" as const,
    scheduleText: "ตรวจตามรอบที่ได้รับมอบหมาย",
    unit: { code: "IT", name: "ฝ่าย IT" },
    category: { name: "ระบบคอมพิวเตอร์" },
    relevantOccurrence: null,
};

const REFERENCE = {
    units: [{ id: 1, code: "IT", name: "ฝ่าย IT" }],
    categories: [{ id: 2, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
    scheduleTypes: [
        "MONTHLY_DAY",
        "MONTH_END",
        "INTERVAL_MONTHS",
        "YEARLY_DATE",
        "ONE_TIME",
        "MANUAL",
    ] as const,
    businessDayPolicies: [
        "NONE",
        "PREVIOUS_BUSINESS_DAY",
        "NEXT_BUSINESS_DAY",
    ] as const,
};

const DETAIL: LiffRoutineTaskDetail = {
    id: 71,
    title: "ตรวจสอบระบบ",
    description: "รายละเอียดฉบับเต็ม",
    scheduleType: "MONTHLY_DAY",
    scheduleConfig: { day: 10, monthOffset: 0 },
    scheduleText: "ทุกวันที่ 10 ของเดือน",
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    contractText: "สัญญารายปี",
    extraDetails: "รายละเอียดเพิ่มเติม",
    businessDayPolicy: "NONE",
    isActive: true,
    version: 3,
    unit: { id: 1, code: "IT", name: "ฝ่าย IT" },
    category: { id: 2, name: "ระบบคอมพิวเตอร์" },
    reminderRules: [{
        daysBefore: 1,
        sendHour: 9,
        channel: "IN_APP",
        recipientScope: "ASSIGNEES",
        isActive: true,
    }],
    occurrences: [{
        id: 91,
        taskId: 71,
        periodKey: "2026-08",
        dueDate: "2026-08-10",
        originalDueDate: "2026-08-10",
        timingStatus: "DUE_TODAY",
        isOverdue: false,
        daysUntilDue: 0,
    }],
    canEdit: true,
    canDelete: true,
};

type DetailOccurrence = LiffRoutineTaskDetail["occurrences"][number];

function makeOccurrence(
    id: number,
    taskId: number,
    dueDate: string,
    timingStatus: DetailOccurrence["timingStatus"],
    daysUntilDue: number,
): DetailOccurrence {
    return {
        id,
        taskId,
        periodKey: dueDate.slice(0, 7),
        dueDate,
        originalDueDate: dueDate,
        timingStatus,
        isOverdue: daysUntilDue < 0,
        daysUntilDue,
    };
}

function getRelevantOccurrenceSection(dialog: HTMLElement): HTMLElement {
    const heading = within(dialog).getByText("รอบที่เกี่ยวข้อง");
    const section = heading.closest("section");
    if (!(section instanceof HTMLElement)) {
        throw new Error("Expected the relevant occurrence heading to be inside a section");
    }
    return section;
}

function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
} {
    let resolvePromise: (value: T) => void = () => undefined;
    let rejectPromise: (reason?: unknown) => void = () => undefined;
    const promise = new Promise<T>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function tasksResponse(
    tasks = [TASK],
    pages = 1,
    page = 1,
) {
    return {
        tasks,
        pagination: {
            page,
            limit: 12,
            total: tasks.length,
            pages,
        },
    };
}

describe("LiffRoutineApp", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.useSearchParams.mockReturnValue(new URLSearchParams());
        mocks.fetchLiffRoutineSummary.mockResolvedValue(SUMMARY);
        mocks.fetchLiffRoutineTasks.mockResolvedValue(tasksResponse());
        mocks.fetchLiffRoutineReference.mockResolvedValue(REFERENCE);
        mocks.fetchLiffRoutineTask.mockResolvedValue({ task: DETAIL });
        mocks.createLiffRoutineTask.mockResolvedValue({
            task: DETAIL,
            replayed: false,
        });
        mocks.updateLiffRoutineTask.mockResolvedValue({ task: DETAIL });
        mocks.deleteLiffRoutineTask.mockResolvedValue(undefined);
    });

    it("loads the Routine summary and task list", async () => {
        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(
                screen.getByRole("heading", { name: "งาน Routine ของฉัน" }),
            ).toBeInTheDocument();
        });

        expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(1);
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledWith({
            page: 1,
            limit: 12,
        });
        expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument();
        expect(screen.getByText("IT · ฝ่าย IT")).toBeInTheDocument();
        expect(screen.getByText("ระบบคอมพิวเตอร์")).toBeInTheDocument();
        expect(screen.getByLabelText("ถึงกำหนดวันนี้ 1 งาน")).toBeInTheDocument();
        expect(screen.getByLabelText("ใกล้ถึงกำหนด 2 งาน")).toBeInTheDocument();
        expect(screen.getByLabelText("ภายใน 30 วัน 3 งาน")).toBeInTheDocument();
        expect(screen.getByText("ยังไม่มีกำหนดรอบถัดไป")).toBeInTheDocument();
    });

    it("renders timing status and due-date presentation from the Routine service", async () => {
        mocks.fetchLiffRoutineTasks.mockResolvedValueOnce(
            tasksResponse([{
                ...TASK,
                relevantOccurrence: {
                    dueDate: "2026-08-10",
                    timingStatus: "DUE_TODAY" as const,
                    isOverdue: false,
                    daysUntilDue: 0,
                },
            }]),
        );

        render(<LiffRoutineApp />);

        await waitFor(() => expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument());
        expect(screen.getByText("วันนี้")).toBeInTheDocument();
        expect(screen.getByText("10 สิงหาคม 2569 · วันนี้")).toBeInTheDocument();
    });

    it("keeps a long Thai task title and its timing status available together", async () => {
        const longTitle =
            "ตรวจสอบและสรุปผลการบำรุงรักษาระบบเครือข่ายประจำสำนักงานประจำเดือน";
        mocks.fetchLiffRoutineTasks.mockResolvedValueOnce(
            tasksResponse([{
                ...TASK,
                title: longTitle,
                relevantOccurrence: {
                    dueDate: "2026-08-13",
                    timingStatus: "DUE_SOON" as const,
                    isOverdue: false,
                    daysUntilDue: 3,
                },
            }]),
        );

        render(<LiffRoutineApp />);

        const title = await screen.findByRole("heading", { name: longTitle });
        const taskCard = title.closest('[data-slot="card"]');
        if (!(taskCard instanceof HTMLElement)) {
            throw new Error("Expected the task heading to be inside a card");
        }

        expect(within(taskCard).getByText("ใกล้ถึงกำหนด")).toBeInTheDocument();
        expect(
            within(taskCard).getByText("13 สิงหาคม 2569 · อีก 3 วัน"),
        ).toBeInTheDocument();
    });

    it("focuses a task from a LINE deep link without bypassing the normal list", async () => {
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=71&occurrenceId=91"),
        );
        mocks.fetchLiffRoutineTasks
            .mockResolvedValueOnce(tasksResponse([{
                ...TASK,
                relevantOccurrence: {
                    dueDate: "2026-08-10",
                    timingStatus: "DUE_TODAY" as const,
                    isOverdue: false,
                    daysUntilDue: 0,
                },
            }]))
            .mockResolvedValueOnce(tasksResponse());

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByText("งานจากการแจ้งเตือน")).toBeInTheDocument();
        });
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenNthCalledWith(1, {
            page: 1,
            limit: 1,
            taskId: 71,
            occurrenceId: 91,
        });
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenNthCalledWith(2, {
            page: 1,
            limit: 12,
        });
    });

    it("falls back to the authorized list when a focused task is unavailable", async () => {
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=999&occurrenceId=998"),
        );
        mocks.fetchLiffRoutineTasks
            .mockResolvedValueOnce(tasksResponse([]))
            .mockResolvedValueOnce(tasksResponse());

        render(<LiffRoutineApp />);

        expect(
            await screen.findByText(
                "ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์เข้าถึงรายการดังกล่าว กำลังแสดงงาน Routine ของคุณตามปกติ",
            ),
        ).toBeInTheDocument();
        expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument();
    });

    it("shows a distinct empty state when the employee has no assigned tasks", async () => {
        mocks.fetchLiffRoutineTasks.mockResolvedValueOnce(tasksResponse([]));

        render(<LiffRoutineApp />);

        expect(
            await screen.findByText("ยังไม่มีงาน Routine ที่ได้รับมอบหมาย"),
        ).toBeInTheDocument();
    });

    it("shows a safe Routine error and supports retry", async () => {
        mocks.fetchLiffRoutineSummary
            .mockRejectedValueOnce(
                new mocks.MockLiffApiError(
                    "บัญชี NHF นี้ยังไม่สามารถเข้าถึง Routine ได้",
                    403,
                ),
            )
            .mockResolvedValueOnce(SUMMARY);

        render(<LiffRoutineApp />);

        expect(
            await screen.findByRole("heading", { name: "เปิด My Routine ไม่สำเร็จ" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("บัญชี NHF นี้ยังไม่สามารถเข้าถึง Routine ได้"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
        expect(
            await screen.findByRole("heading", { name: "งาน Routine ของฉัน" }),
        ).toBeInTheDocument();
    });

    it("changes the timing filter and requests only the selected status", async () => {
        mocks.fetchLiffRoutineTasks
            .mockResolvedValueOnce(tasksResponse())
            .mockResolvedValueOnce(tasksResponse([]));

        render(<LiffRoutineApp />);
        await waitFor(() => expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument());

        const todayFilter = screen.getByRole("button", { name: "วันนี้" });
        fireEvent.click(todayFilter);

        await waitFor(() => {
            expect(mocks.fetchLiffRoutineTasks).toHaveBeenLastCalledWith({
                page: 1,
                limit: 12,
                timingStatus: "DUE_TODAY",
            });
        });
        expect(todayFilter).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("ไม่พบงานตามตัวกรองนี้")).toBeInTheDocument();
    });

    it("loads the next page without replacing the first page", async () => {
        const secondTask = { ...TASK, id: 72, title: "งานหน้าถัดไป" };
        mocks.fetchLiffRoutineTasks
            .mockResolvedValueOnce(tasksResponse([TASK], 2, 1))
            .mockResolvedValueOnce(tasksResponse([secondTask], 2, 2));

        render(<LiffRoutineApp />);
        await waitFor(() => expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "โหลดเพิ่มเติม" }));

        await waitFor(() => expect(screen.getByText("งานหน้าถัดไป")).toBeInTheDocument());
        expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument();
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenLastCalledWith({
            page: 2,
            limit: 12,
        });
    });

    it("deduplicates a focused task when a later page contains it again", async () => {
        const firstPageTask = { ...TASK, id: 72, title: "งานหน้าแรก" };
        const laterPageTask = { ...TASK, id: 73, title: "งานใหม่จากหน้าถัดไป" };
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=71&occurrenceId=91"),
        );
        mocks.fetchLiffRoutineTasks
            .mockResolvedValueOnce(tasksResponse([TASK]))
            .mockResolvedValueOnce(tasksResponse([firstPageTask], 2, 1))
            .mockResolvedValueOnce(tasksResponse([TASK, laterPageTask], 2, 2));

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByText("งานจากการแจ้งเตือน")).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("button", { name: "โหลดเพิ่มเติม" }));

        await waitFor(() => {
            expect(screen.getByText("งานใหม่จากหน้าถัดไป")).toBeInTheDocument();
        });
        expect(screen.getAllByText("ตรวจสอบระบบ")).toHaveLength(1);
        expect(screen.getByText("งานหน้าแรก")).toBeInTheDocument();
    });

    it("opens the current task detail and shows edit and delete controls for authorized tasks", async () => {
        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");

        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        expect(await screen.findByText("รายละเอียดฉบับเต็ม")).toBeInTheDocument();
        expect(screen.getByText("ทุกวันที่ 10 ของเดือน")).toBeInTheDocument();
        expect(screen.getByText("สัญญารายปี")).toBeInTheDocument();
        const detailDialog = screen.getByRole("dialog");
        const detailScrollArea = detailDialog.querySelector('[data-slot="sheet-scroll-area"]');
        const editButton = screen.getByRole("button", { name: "แก้ไขงาน" });
        const deleteButton = screen.getByRole("button", { name: "ลบงานนี้" });
        expect(detailDialog).toHaveAttribute("data-scroll-owner", "area");
        expect(detailDialog.querySelectorAll('[data-slot="sheet-scroll-area"]')).toHaveLength(1);
        expect(detailScrollArea).not.toContainElement(editButton);
        expect(detailScrollArea).not.toContainElement(deleteButton);
        expect(screen.getByRole("button", { name: "ปิดรายละเอียดงาน Routine" })).toHaveClass("z-30");
        expect(mocks.fetchLiffRoutineTask).toHaveBeenCalledWith(71);
    });

    it("shows an assigned master task edit control without delete access", async () => {
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({
            task: {
                ...DETAIL,
                canEdit: true,
                canDelete: false,
            },
        });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        expect(await screen.findByText("รอบที่เกี่ยวข้อง")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "แก้ไขงาน" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ลบงานนี้" })).not.toBeInTheDocument();
    });

    it("shows assigned occurrence detail without master management controls", async () => {
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=71&occurrenceId=91"),
        );
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({
            task: {
                ...DETAIL,
                canEdit: false,
                canDelete: false,
                reminderRules: [],
            },
        });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        expect(await screen.findByText("รอบที่เกี่ยวข้อง")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "แก้ไขงาน" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ลบงานนี้" })).not.toBeInTheDocument();
    });

    it("ignores a stale detail response after quickly switching tasks", async () => {
        const firstDetail = deferred<{ task: LiffRoutineTaskDetail }>();
        const secondDetail = deferred<{ task: LiffRoutineTaskDetail }>();
        const secondTask = { ...TASK, id: 72, title: "งานที่สอง" };
        mocks.fetchLiffRoutineTasks.mockResolvedValueOnce(
            tasksResponse([TASK, secondTask]),
        );
        mocks.fetchLiffRoutineTask
            .mockImplementationOnce(() => firstDetail.promise)
            .mockImplementationOnce(() => secondDetail.promise);

        render(<LiffRoutineApp />);
        await screen.findByText("งานที่สอง");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );
        fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียดงาน Routine" }));
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน งานที่สอง" }),
        );

        secondDetail.resolve({
            task: { ...DETAIL, id: 72, title: "รายละเอียดงานที่สอง" },
        });
        const detailDialog = await screen.findByRole("dialog");
        expect(detailDialog).toHaveAttribute("data-scroll-owner", "area");
        expect(detailDialog.querySelectorAll('[data-slot="sheet-scroll-area"]')).toHaveLength(1);
        expect(within(detailDialog).getByRole("heading", { name: "รายละเอียดงานที่สอง" })).toBeInTheDocument();

        firstDetail.resolve({ task: DETAIL });
        await waitFor(() => {
            expect(within(detailDialog).getByRole("heading", { name: "รายละเอียดงานที่สอง" })).toBeInTheDocument();
        });
    });

    it("ignores an older bootstrap response after the deep-link target changes", async () => {
        const firstSummary = deferred<typeof SUMMARY>();
        const secondSummary = deferred<typeof SUMMARY>();
        const firstFocused = deferred<ReturnType<typeof tasksResponse>>();
        const secondFocused = deferred<ReturnType<typeof tasksResponse>>();
        const firstList = deferred<ReturnType<typeof tasksResponse>>();
        const secondList = deferred<ReturnType<typeof tasksResponse>>();
        const firstTask = { ...TASK, title: "งานเป้าหมายแรก" };
        const secondTask = { ...TASK, id: 72, title: "งานเป้าหมายที่สอง" };
        let normalListCall = 0;

        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=71&occurrenceId=91"),
        );
        mocks.fetchLiffRoutineSummary
            .mockImplementationOnce(() => firstSummary.promise)
            .mockImplementationOnce(() => secondSummary.promise);
        mocks.fetchLiffRoutineTasks.mockImplementation((input: { taskId?: number }) => {
            if (input.taskId === 71) return firstFocused.promise;
            if (input.taskId === 72) return secondFocused.promise;
            normalListCall += 1;
            return normalListCall === 1 ? firstList.promise : secondList.promise;
        });

        const { rerender } = render(<LiffRoutineApp />);
        await waitFor(() => {
            expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(1);
        });

        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=72&occurrenceId=92"),
        );
        rerender(<LiffRoutineApp />);
        await waitFor(() => {
            expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(2);
        });

        secondFocused.resolve(tasksResponse([secondTask]));
        secondList.resolve(tasksResponse([secondTask]));
        secondSummary.resolve({
            summary: { ...SUMMARY.summary, today: 9 },
        });
        expect(await screen.findByText("งานเป้าหมายที่สอง")).toBeInTheDocument();

        firstFocused.resolve(tasksResponse([firstTask]));
        firstList.resolve(tasksResponse([firstTask]));
        firstSummary.resolve(SUMMARY);
        await waitFor(() => {
            expect(screen.getByText("งานเป้าหมายที่สอง")).toBeInTheDocument();
        });
        expect(screen.queryByText("งานเป้าหมายแรก")).not.toBeInTheDocument();
    });

    it("opens a create form without assignee controls and sends only the LIFF payload", async () => {
        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));

        const formDialog = await screen.findByRole("dialog");
        const formScrollArea = formDialog.querySelector('[data-slot="sheet-scroll-area"]');
        const formSubmit = within(formDialog).getByRole("button", { name: "เพิ่ม Routine ของฉัน" });
        expect(formDialog).toHaveAttribute("data-scroll-owner", "area");
        expect(formDialog.querySelectorAll('[data-slot="sheet-scroll-area"]')).toHaveLength(1);
        expect(formScrollArea).not.toContainElement(formSubmit);
        expect(formSubmit.closest("form")).not.toBeNull();
        expect(within(formDialog).getByRole("heading", { name: "เพิ่ม Routine ของฉัน" })).toBeInTheDocument();
        expect(within(formDialog).queryByText("เลือกผู้รับผิดชอบ")).not.toBeInTheDocument();
        expect(
            within(formDialog).queryByRole("checkbox", { name: "เปิดใช้งานงานนี้" }),
        ).not.toBeInTheDocument();

        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หน่วยงาน" }), {
            target: { value: "1" },
        });
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หมวดหมู่" }), {
            target: { value: "2" },
        });
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "งานใหม่ของฉัน" },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));

        await waitFor(() => expect(mocks.createLiffRoutineTask).toHaveBeenCalledTimes(1));
        const [payload] = mocks.createLiffRoutineTask.mock.calls[0] as [Record<string, unknown>, string];
        expect(payload).toMatchObject({
            unitId: 1,
            categoryId: 2,
            title: "งานใหม่ของฉัน",
            scheduleType: "MONTHLY_DAY",
            isActive: true,
        });
        expect(payload).not.toHaveProperty("assignees");
        expect(payload).not.toHaveProperty("sourceFileName");
        expect(payload).not.toHaveProperty("sourceSheet");
        expect(payload).not.toHaveProperty("sourceRow");
        expect(mocks.fetchLiffRoutineReference).toHaveBeenCalledTimes(1);
    });

    it("keeps one create idempotency key when the same logical submission is retried", async () => {
        mocks.createLiffRoutineTask
            .mockRejectedValueOnce(new mocks.MockLiffApiError("เครือข่ายขัดข้อง"))
            .mockResolvedValueOnce({ task: DETAIL, replayed: false });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        const formDialog = await screen.findByRole("dialog");
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หน่วยงาน" }), {
            target: { value: "1" },
        });
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หมวดหมู่" }), {
            target: { value: "2" },
        });
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "ลองสร้างอีกครั้ง" },
        });

        const submit = () =>
            fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        submit();
        expect(await screen.findByText("เครือข่ายขัดข้อง")).toBeInTheDocument();
        submit();

        await waitFor(() => expect(mocks.createLiffRoutineTask).toHaveBeenCalledTimes(2));
        const firstKey = (mocks.createLiffRoutineTask.mock.calls[0] as [unknown, string])[1];
        const secondKey = (mocks.createLiffRoutineTask.mock.calls[1] as [unknown, string])[1];
        expect(firstKey).toBeTruthy();
        expect(secondKey).toBe(firstKey);
    });

    it("refreshes Routine state after recovered create ambiguity without auto retrying", async () => {
        mocks.createLiffRoutineTask
            .mockRejectedValueOnce(new mocks.MockLiffApiError(
                "session recovered",
                401,
                { recovered: true, replayed: false },
            ))
            .mockResolvedValueOnce({ task: DETAIL, replayed: false });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        const formDialog = await screen.findByRole("dialog");
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หน่วยงาน" }), {
            target: { value: "1" },
        });
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หมวดหมู่" }), {
            target: { value: "2" },
        });
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "งานที่อาจสร้างแล้ว" },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));

        await waitFor(() => expect(mocks.createLiffRoutineTask).toHaveBeenCalledTimes(1));
        expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(2);
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("heading", { name: "เพิ่ม Routine ของฉัน" })).toBeInTheDocument();
        expect(screen.getAllByText(
            "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว กรุณาตรวจสอบสถานะล่าสุดก่อนลองดำเนินการอีกครั้ง",
        ).length).toBeGreaterThan(0);

        const firstKey = (mocks.createLiffRoutineTask.mock.calls[0] as [unknown, string])[1];
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        await waitFor(() => expect(mocks.createLiffRoutineTask).toHaveBeenCalledTimes(2));
        const secondKey = (mocks.createLiffRoutineTask.mock.calls[1] as [unknown, string])[1];
        expect(secondKey).toBe(firstKey);
    });

    it("prevents duplicate create submissions while the request is in flight", async () => {
        const pendingCreate = deferred<{ task: LiffRoutineTaskDetail; replayed: boolean }>();
        mocks.createLiffRoutineTask.mockImplementationOnce(() => pendingCreate.promise);

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        const formDialog = await screen.findByRole("dialog");
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หน่วยงาน" }), {
            target: { value: "1" },
        });
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หมวดหมู่" }), {
            target: { value: "2" },
        });
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "ส่งครั้งเดียว" },
        });

        const submitButton = within(formDialog).getByRole("button", { name: "เพิ่ม Routine ของฉัน" });
        fireEvent.click(submitButton);
        fireEvent.click(submitButton);
        await waitFor(() => expect(mocks.createLiffRoutineTask).toHaveBeenCalledTimes(1));

        pendingCreate.resolve({ task: DETAIL, replayed: false });
        await waitFor(() => expect(screen.queryByRole("heading", { name: "เพิ่ม Routine ของฉัน" })).not.toBeInTheDocument());
    });

    it("protects dirty create forms from accidental closing", async () => {
        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        const formDialog = await screen.findByRole("dialog");
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "งานที่ยังไม่ได้บันทึก" },
        });

        fireEvent.click(screen.getByRole("button", { name: "ปิดเพิ่ม Routine ของฉัน" }));
        const discardDialog = await screen.findByRole("alertdialog");
        expect(discardDialog).toHaveAttribute("data-scroll-owner", "content");
        expect(within(discardDialog).getByText("หากออกตอนนี้ การแก้ไขล่าสุดจะหายไป")).toBeInTheDocument();
        fireEvent.click(within(discardDialog).getByRole("button", { name: "ออกโดยไม่บันทึก" }));

        await waitFor(() => expect(screen.queryByRole("heading", { name: "เพิ่ม Routine ของฉัน" })).not.toBeInTheDocument());
        expect(mocks.createLiffRoutineTask).not.toHaveBeenCalled();
    });

    it("refreshes the list and summary after a successful create", async () => {
        const createdTask = { ...DETAIL, id: 88, title: "สร้างสำเร็จแล้ว" };
        mocks.createLiffRoutineTask.mockResolvedValueOnce({ task: createdTask, replayed: false });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));
        const formDialog = await screen.findByRole("dialog");
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หน่วยงาน" }), {
            target: { value: "1" },
        });
        fireEvent.change(within(formDialog).getByRole("combobox", { name: "หมวดหมู่" }), {
            target: { value: "2" },
        });
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: createdTask.title },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "เพิ่ม Routine ของฉัน" }));

        await waitFor(() => {
            expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(2);
            expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledTimes(2);
        });
        expect(screen.queryByRole("heading", { name: "เพิ่ม Routine ของฉัน" })).not.toBeInTheDocument();
        expect(screen.getByText("สร้างสำเร็จแล้ว")).toBeInTheDocument();
    });

    it("edits only a manageable task with its current version", async () => {
        const updatedTask = { ...DETAIL, title: "แก้ไขแล้ว", version: 4 };
        mocks.updateLiffRoutineTask.mockResolvedValueOnce({ task: updatedTask });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );
        await screen.findByText("รายละเอียดฉบับเต็ม");
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขงาน" }));

        const dialogs = await screen.findAllByRole("dialog");
        const formDialog = dialogs[dialogs.length - 1];
        expect(
            within(formDialog).queryByRole("checkbox", { name: "เปิดใช้งานงานนี้" }),
        ).not.toBeInTheDocument();
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "แก้ไขแล้ว" },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "บันทึกการแก้ไข" }));

        await waitFor(() => expect(mocks.updateLiffRoutineTask).toHaveBeenCalledTimes(1));
        expect(mocks.updateLiffRoutineTask).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ version: 3, title: "แก้ไขแล้ว" }),
        );
        const updatePayload = (mocks.updateLiffRoutineTask.mock.calls[0] as [number, Record<string, unknown>])[1];
        expect(updatePayload).not.toHaveProperty("assignees");
        expect(updatePayload).not.toHaveProperty("sourceFileName");
        expect(updatePayload).not.toHaveProperty("sourceSheet");
        expect(updatePayload).not.toHaveProperty("sourceRow");
        expect(updatePayload).not.toHaveProperty("isActive");
        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: "แก้ไข Routine ของฉัน" })).not.toBeInTheDocument();
            expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(2);
            expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledTimes(2);
        });
    });

    it("preserves an inactive self-created task when editing without a lifecycle control", async () => {
        const inactiveDetail = { ...DETAIL, isActive: false };
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({ task: inactiveDetail });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );
        const detailDialog = await screen.findByRole("dialog");
        expect(await within(detailDialog).findAllByText("ปิดใช้งาน")).not.toHaveLength(0);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขงาน" }));

        const dialogs = await screen.findAllByRole("dialog");
        const formDialog = dialogs[dialogs.length - 1];
        expect(
            within(formDialog).queryByRole("checkbox", { name: "เปิดใช้งานงานนี้" }),
        ).not.toBeInTheDocument();
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "แก้ไขงานที่ปิดใช้งาน" },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "บันทึกการแก้ไข" }));

        await waitFor(() => expect(mocks.updateLiffRoutineTask).toHaveBeenCalledTimes(1));
        const updatePayload = (mocks.updateLiffRoutineTask.mock.calls[0] as [number, Record<string, unknown>])[1];
        expect(updatePayload).not.toHaveProperty("isActive");
    });

    it("selects the nearest current occurrence instead of an older overdue occurrence", async () => {
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({
            task: {
                ...DETAIL,
                occurrences: [
                    makeOccurrence(91, 71, "2026-08-01", "OVERDUE", -30),
                    makeOccurrence(92, 71, "2026-08-31", "DUE_TODAY", 0),
                    makeOccurrence(93, 71, "2026-09-10", "DUE_SOON", 10),
                ],
            },
        });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        const dialog = await screen.findByRole("dialog");
        const relevantSection = getRelevantOccurrenceSection(dialog);
        expect(within(relevantSection).getByText("31 สิงหาคม 2569")).toBeInTheDocument();
        expect(within(relevantSection).getByText("วันนี้")).toBeInTheDocument();
        expect(within(relevantSection).queryByText("1 สิงหาคม 2569")).not.toBeInTheDocument();
    });

    it("selects the earliest future occurrence when no occurrence is due today", async () => {
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({
            task: {
                ...DETAIL,
                occurrences: [
                    makeOccurrence(101, 71, "2026-09-03", "DUE_SOON", 3),
                    makeOccurrence(102, 71, "2026-09-10", "UPCOMING", 10),
                ],
            },
        });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        const dialog = await screen.findByRole("dialog");
        const relevantSection = getRelevantOccurrenceSection(dialog);
        expect(within(relevantSection).getByText("3 กันยายน 2569")).toBeInTheDocument();
        expect(within(relevantSection).getByText("อีก 3 วัน")).toBeInTheDocument();
        expect(within(relevantSection).queryByText("10 กันยายน 2569")).not.toBeInTheDocument();
    });

    it("does not show a historical occurrence as the relevant occurrence", async () => {
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({
            task: {
                ...DETAIL,
                occurrences: [
                    makeOccurrence(111, 71, "2026-07-01", "OVERDUE", -61),
                    makeOccurrence(112, 71, "2026-08-01", "OVERDUE", -30),
                ],
            },
        });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).queryByText("รอบที่เกี่ยวข้อง")).not.toBeInTheDocument();
        expect(within(dialog).getByText("รอบงานและกำหนดส่ง")).toBeInTheDocument();
        expect(within(dialog).getByText("1 กรกฎาคม 2569")).toBeInTheDocument();
        expect(within(dialog).getByText("1 สิงหาคม 2569")).toBeInTheDocument();
    });

    it("prefers the deep-link occurrence for the focused task", async () => {
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=71&occurrenceId=92"),
        );
        mocks.fetchLiffRoutineTask.mockResolvedValueOnce({
            task: {
                ...DETAIL,
                occurrences: [
                    makeOccurrence(91, 71, "2026-08-01", "OVERDUE", -30),
                    makeOccurrence(92, 71, "2026-09-10", "DUE_SOON", 10),
                    makeOccurrence(93, 71, "2026-08-31", "DUE_TODAY", 0),
                ],
            },
        });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );

        const dialog = await screen.findByRole("dialog");
        const relevantSection = getRelevantOccurrenceSection(dialog);
        expect(within(relevantSection).getByText("10 กันยายน 2569")).toBeInTheDocument();
        expect(within(relevantSection).getByText("อีก 10 วัน")).toBeInTheDocument();
        expect(within(relevantSection).queryByText("31 สิงหาคม 2569")).not.toBeInTheDocument();
    });

    it("does not leak deep-link occurrence focus to another task", async () => {
        const secondTask = { ...TASK, id: 72, title: "งานที่สอง" };
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("taskId=71&occurrenceId=92"),
        );
        mocks.fetchLiffRoutineTasks.mockResolvedValue(
            tasksResponse([TASK, secondTask]),
        );
        mocks.fetchLiffRoutineTask
            .mockResolvedValueOnce({
                task: {
                    ...DETAIL,
                    occurrences: [
                        makeOccurrence(91, 71, "2026-08-01", "OVERDUE", -30),
                        makeOccurrence(92, 71, "2026-09-10", "DUE_SOON", 10),
                        makeOccurrence(93, 71, "2026-08-31", "DUE_TODAY", 0),
                    ],
                },
            })
            .mockResolvedValueOnce({
                task: {
                    ...DETAIL,
                    id: 72,
                    title: "รายละเอียดงานที่สอง",
                    occurrences: [
                        makeOccurrence(201, 72, "2026-08-20", "OVERDUE", -11),
                        makeOccurrence(202, 72, "2026-09-04", "DUE_SOON", 4),
                    ],
                },
            });

        render(<LiffRoutineApp />);
        await screen.findByText("งานที่สอง");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );
        const firstDialog = await screen.findByRole("dialog");
        const firstRelevantSection = getRelevantOccurrenceSection(firstDialog);
        expect(within(firstRelevantSection).getByText("10 กันยายน 2569")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียดงาน Routine" }));
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน งานที่สอง" }),
        );

        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByRole("heading", { name: "รายละเอียดงานที่สอง" })).toBeInTheDocument();
        const relevantSection = getRelevantOccurrenceSection(dialog);
        expect(within(relevantSection).getByText("4 กันยายน 2569")).toBeInTheDocument();
        expect(within(relevantSection).getByText("อีก 4 วัน")).toBeInTheDocument();
        expect(within(relevantSection).queryByText("10 กันยายน 2569")).not.toBeInTheDocument();
    });

    it("reloads the latest detail after a stale update without silently retrying", async () => {
        const latestTask = { ...DETAIL, title: "ฉบับล่าสุดบนระบบ", version: 4 };
        mocks.updateLiffRoutineTask.mockRejectedValueOnce(
            new mocks.MockLiffApiError("ข้อมูล Routine เปลี่ยนแปลงแล้ว", 409),
        );
        mocks.fetchLiffRoutineTask
            .mockResolvedValueOnce({ task: DETAIL })
            .mockResolvedValueOnce({ task: latestTask });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );
        await screen.findByText("รายละเอียดฉบับเต็ม");
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขงาน" }));
        const dialogs = await screen.findAllByRole("dialog");
        const formDialog = dialogs[dialogs.length - 1];
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "ฉบับที่ฉันกำลังแก้" },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "บันทึกการแก้ไข" }));

        expect(await screen.findByText("งาน Routine นี้ถูกเปลี่ยนแปลงแล้ว ระบบโหลดข้อมูลล่าสุดให้แล้ว กรุณาตรวจสอบก่อนบันทึกอีกครั้ง")).toBeInTheDocument();
        expect(screen.getByText("ฉบับล่าสุดบนระบบ")).toBeInTheDocument();
        expect(mocks.updateLiffRoutineTask).toHaveBeenCalledTimes(1);
        expect(mocks.fetchLiffRoutineTask).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("button", { name: "ใช้ข้อมูลล่าสุดและแก้ไขต่อ" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ใช้ข้อมูลล่าสุดและแก้ไขต่อ" }));
        expect(within(formDialog).getByRole("textbox", { name: "ชื่องาน" })).toHaveValue("ฉบับล่าสุดบนระบบ");
    });

    it("reloads the latest version after recovered update ambiguity while keeping the draft", async () => {
        const latestTask = { ...DETAIL, title: "ฉบับล่าสุดบนระบบ", version: 4 };
        mocks.updateLiffRoutineTask.mockRejectedValueOnce(
            new mocks.MockLiffApiError(
                "session recovered",
                401,
                { recovered: true, replayed: false },
            ),
        );
        mocks.fetchLiffRoutineTask
            .mockResolvedValueOnce({ task: DETAIL })
            .mockResolvedValueOnce({ task: latestTask });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }));
        await screen.findByText("รายละเอียดฉบับเต็ม");
        fireEvent.click(screen.getByRole("button", { name: "แก้ไขงาน" }));
        const dialogs = await screen.findAllByRole("dialog");
        const formDialog = dialogs[dialogs.length - 1];
        fireEvent.change(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }), {
            target: { value: "ร่างที่ยังไม่ต้องการทับ" },
        });
        fireEvent.click(within(formDialog).getByRole("button", { name: "บันทึกการแก้ไข" }));

        expect(await screen.findByText(
            "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว กรุณาตรวจสอบสถานะล่าสุดก่อนลองดำเนินการอีกครั้ง",
        )).toBeInTheDocument();
        expect(screen.getByText("ฉบับล่าสุดบนระบบ")).toBeInTheDocument();
        expect(within(formDialog).getByRole("textbox", { name: "ชื่องาน" }))
            .toHaveValue("ร่างที่ยังไม่ต้องการทับ");
        expect(mocks.updateLiffRoutineTask).toHaveBeenCalledTimes(1);
        expect(mocks.fetchLiffRoutineTask).toHaveBeenCalledTimes(2);
    });

    it("requires delete confirmation and refreshes after one successful delete", async () => {
        const pendingDelete = deferred<void>();
        mocks.deleteLiffRoutineTask.mockImplementationOnce(() => pendingDelete.promise);

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(
            screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }),
        );
        await screen.findByText("รายละเอียดฉบับเต็ม");
        fireEvent.click(screen.getByRole("button", { name: "ลบงานนี้" }));

        const confirmation = await screen.findByRole("alertdialog");
        expect(within(confirmation).getByText("งาน “ตรวจสอบระบบ” จะถูกลบและไม่แสดงในรายการของคุณอีก การดำเนินการนี้ย้อนกลับไม่ได้")).toBeInTheDocument();
        expect(mocks.deleteLiffRoutineTask).not.toHaveBeenCalled();
        const confirmButton = within(confirmation).getByRole("button", { name: "ลบงานนี้" });
        fireEvent.click(confirmButton);
        fireEvent.click(confirmButton);
        await waitFor(() => expect(mocks.deleteLiffRoutineTask).toHaveBeenCalledTimes(1));
        expect(within(confirmation).getByRole("button", { name: "กำลังลบ..." })).toBeDisabled();

        pendingDelete.resolve();
        await waitFor(() => expect(screen.queryByText("รายละเอียดฉบับเต็ม")).not.toBeInTheDocument());
        expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(2);
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledTimes(2);
    });

    it("refreshes task existence after recovered delete ambiguity without deleting twice", async () => {
        mocks.deleteLiffRoutineTask.mockRejectedValueOnce(
            new mocks.MockLiffApiError(
                "session recovered",
                401,
                { recovered: true, replayed: false },
            ),
        );
        mocks.fetchLiffRoutineTask
            .mockResolvedValueOnce({ task: DETAIL })
            .mockResolvedValueOnce({ task: DETAIL });

        render(<LiffRoutineApp />);
        await screen.findByText("ตรวจสอบระบบ");
        fireEvent.click(screen.getByRole("button", { name: "เปิดรายละเอียดงาน ตรวจสอบระบบ" }));
        await screen.findByText("รายละเอียดฉบับเต็ม");
        fireEvent.click(screen.getByRole("button", { name: "ลบงานนี้" }));
        const confirmation = await screen.findByRole("alertdialog");
        fireEvent.click(within(confirmation).getByRole("button", { name: "ลบงานนี้" }));

        await waitFor(() => expect(mocks.deleteLiffRoutineTask).toHaveBeenCalledTimes(1));
        expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(2);
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledTimes(2);
        expect(mocks.fetchLiffRoutineTask).toHaveBeenCalledTimes(2);
        expect(within(confirmation).getByRole("button", { name: "ลบงานนี้" })).toBeInTheDocument();
    });
});
