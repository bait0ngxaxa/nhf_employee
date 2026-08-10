import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    class MockLiffApiError extends Error {
        readonly status: number | undefined;

        constructor(message: string, status?: number) {
            super(message);
            this.name = "LiffApiError";
            this.status = status;
        }
    }

    return {
        liff: {
            init: vi.fn(),
            isLoggedIn: vi.fn(),
            login: vi.fn(),
            getIDToken: vi.fn(),
        },
        useSearchParams: vi.fn(),
        establishLiffSession: vi.fn(),
        fetchLiffRoutineSummary: vi.fn(),
        fetchLiffRoutineTasks: vi.fn(),
        linkLiffAccount: vi.fn(),
        MockLiffApiError,
    };
});

vi.mock("@line/liff", () => ({ default: mocks.liff }));

vi.mock("next/navigation", () => ({
    useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/client/liff-routine", () => ({
    LiffApiError: mocks.MockLiffApiError,
    establishLiffSession: mocks.establishLiffSession,
    fetchLiffRoutineSummary: mocks.fetchLiffRoutineSummary,
    fetchLiffRoutineTasks: mocks.fetchLiffRoutineTasks,
    linkLiffAccount: mocks.linkLiffAccount,
}));

import { LiffRoutineApp } from "@/components/liff/routine/LiffRoutineApp";
import type { LiffRoutineTaskWorkItem } from "@/lib/line/routine-types";

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
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_LINE_ROUTINE_LIFF_ID", "routine-liff-id");
        mocks.useSearchParams.mockReturnValue(new URLSearchParams());
        mocks.liff.init.mockResolvedValue(undefined);
        mocks.liff.isLoggedIn.mockReturnValue(true);
        mocks.liff.login.mockReturnValue(undefined);
        mocks.liff.getIDToken.mockReturnValue("line-id-token");
        mocks.establishLiffSession.mockResolvedValue({ linked: true });
        mocks.fetchLiffRoutineSummary.mockResolvedValue(SUMMARY);
        mocks.fetchLiffRoutineTasks.mockResolvedValue(tasksResponse());
        mocks.linkLiffAccount.mockResolvedValue({ linked: true });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("initializes LIFF, establishes a session, and reaches READY", async () => {
        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "งาน Routine ของฉัน" })).toBeInTheDocument();
        });

        expect(mocks.liff.init).toHaveBeenCalledWith({ liffId: "routine-liff-id" });
        expect(mocks.liff.getIDToken).toHaveBeenCalled();
        expect(mocks.establishLiffSession).toHaveBeenCalledWith("line-id-token");
        expect(mocks.fetchLiffRoutineSummary).toHaveBeenCalledTimes(1);
        expect(mocks.fetchLiffRoutineTasks).toHaveBeenCalledWith({ page: 1, limit: 12 });
        expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument();
        expect(screen.getByText("IT · ฝ่าย IT")).toBeInTheDocument();
        expect(screen.getByText("ระบบคอมพิวเตอร์")).toBeInTheDocument();
        expect(screen.getByLabelText("ถึงกำหนดวันนี้ 1 งาน")).toBeInTheDocument();
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

    it("shows a distinct empty state when the employee has no assigned tasks", async () => {
        mocks.fetchLiffRoutineTasks.mockResolvedValueOnce(tasksResponse([]));

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByText("ยังไม่มีงาน Routine ที่ได้รับมอบหมาย")).toBeInTheDocument();
        });
    });

    it("shows the NHF account-link action for an unlinked LINE identity", async () => {
        mocks.establishLiffSession.mockResolvedValueOnce({ linked: false });

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "เชื่อมบัญชี NHF" })).toBeInTheDocument();
        });

        expect(screen.getByRole("button", { name: "เชื่อมบัญชี NHF" })).toBeInTheDocument();
        expect(mocks.fetchLiffRoutineSummary).not.toHaveBeenCalled();
    });

    it("resumes an explicit link intent after NHF login", async () => {
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("link=1&loginReturn=1"),
        );

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "งาน Routine ของฉัน" })).toBeInTheDocument();
        });

        expect(mocks.linkLiffAccount).toHaveBeenCalledWith("line-id-token");
        expect(mocks.establishLiffSession).not.toHaveBeenCalled();
    });

    it("starts LINE login when the LIFF user is not logged in", async () => {
        mocks.liff.isLoggedIn.mockReturnValueOnce(false);

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByText("กำลังยืนยันตัวตนกับ LINE...")).toBeInTheDocument();
        });
        expect(mocks.liff.login).toHaveBeenCalledWith({
            redirectUri: expect.stringContaining("lineLogin=1"),
        });
        expect(mocks.liff.getIDToken).not.toHaveBeenCalled();
    });

    it("stops after an incomplete LINE login instead of redirecting in a loop", async () => {
        mocks.useSearchParams.mockReturnValue(new URLSearchParams("lineLogin=1"));
        mocks.liff.isLoggedIn.mockReturnValue(false);

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "เปิด My Routine ไม่สำเร็จ" })).toBeInTheDocument();
        });
        expect(screen.getByText("การเข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
        expect(mocks.liff.login).not.toHaveBeenCalled();
    });

    it("shows a retryable state when LIFF initialization fails", async () => {
        mocks.liff.init.mockRejectedValueOnce(new Error("LIFF init failed"));

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "เปิด My Routine ไม่สำเร็จ" })).toBeInTheDocument();
        });
        expect(screen.getByText("ไม่สามารถเปิด My Routine ได้ กรุณาลองใหม่อีกครั้ง")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ลองใหม่" })).toBeInTheDocument();
    });

    it("shows a safe error when LINE cannot provide an ID token", async () => {
        mocks.liff.getIDToken.mockReturnValueOnce(null);

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "เปิด My Routine ไม่สำเร็จ" })).toBeInTheDocument();
        });
        expect(
            screen.getByText("ไม่สามารถเปิด My Routine ได้ กรุณาลองใหม่อีกครั้ง"),
        ).toBeInTheDocument();
        expect(mocks.establishLiffSession).not.toHaveBeenCalled();
    });

    it("shows a safe message for an account-link conflict", async () => {
        mocks.useSearchParams.mockReturnValue(
            new URLSearchParams("link=1&loginReturn=1"),
        );
        mocks.linkLiffAccount.mockRejectedValueOnce(
            new mocks.MockLiffApiError(
                "บัญชี LINE หรือบัญชี NHF นี้ถูกเชื่อมกับบัญชีอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ",
                409,
            ),
        );

        render(<LiffRoutineApp />);

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "เปิด My Routine ไม่สำเร็จ" })).toBeInTheDocument();
        });
        expect(
            screen.getByText("บัญชี LINE หรือบัญชี NHF นี้ถูกเชื่อมกับบัญชีอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ"),
        ).toBeInTheDocument();
    });

    it("changes the timing filter and requests only the selected status", async () => {
        mocks.fetchLiffRoutineTasks
            .mockResolvedValueOnce(tasksResponse())
            .mockResolvedValueOnce(tasksResponse([]));

        render(<LiffRoutineApp />);
        await waitFor(() => expect(screen.getByText("ตรวจสอบระบบ")).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "วันนี้" }));

        await waitFor(() => {
            expect(mocks.fetchLiffRoutineTasks).toHaveBeenLastCalledWith({
                page: 1,
                limit: 12,
                timingStatus: "DUE_TODAY",
            });
        });
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
});
