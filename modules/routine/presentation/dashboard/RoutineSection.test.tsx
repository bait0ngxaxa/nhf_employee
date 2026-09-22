import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ReactNode } from "react";

import { RoutineSection } from "./RoutineSection";
import type { RoutinePresentationCapabilities } from "../../application/types";
import type {
    PaginatedRoutineTaskWorkItemsResponse,
    RoutineTaskWorkItem,
} from "./types";

const mocks = vi.hoisted(() => ({
    useDashboardDataContext: vi.fn(),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    mutateSummary: vi.fn(),
    mutateTasks: vi.fn(),
    triggerDownload: vi.fn(),
    useSWR: vi.fn((_key: unknown) => ({
        data: undefined as unknown,
        error: undefined as Error | undefined,
        isLoading: false,
        mutate: vi.fn(),
    })),
}));

type RoutineResponseSuccess = (
    data: PaginatedRoutineTaskWorkItemsResponse,
    key: string,
) => void;

function isOnSuccessConfig(value: unknown): value is { onSuccess: unknown } {
    return typeof value === "object"
        && value !== null
        && "onSuccess" in value;
}

function getOccurrenceKeys(): string[] {
    return (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
        .map(([key]) => typeof key === "string" ? key : "")
        .filter((key) => key.includes("/api/routines/occurrences"));
}

function getLatestOccurrenceKey(): string {
    const key = getOccurrenceKeys().at(-1);
    if (!key) {
        throw new Error("Expected an operational Routine query key");
    }
    return key;
}

function getOccurrenceSuccess(key: string): RoutineResponseSuccess {
    const call = (mocks.useSWR.mock.calls as unknown as Array<[unknown, unknown, unknown]>)
        .find(([calledKey]) => calledKey === key);
    const config = call?.[2];
    if (!isOnSuccessConfig(config) || typeof config.onSuccess !== "function") {
        throw new Error(`Expected an onSuccess callback for ${key}`);
    }
    return config.onSuccess as RoutineResponseSuccess;
}

function routineResponse(pages: number): PaginatedRoutineTaskWorkItemsResponse {
    return {
        tasks: [],
        pagination: {
            page: Math.min(3, pages),
            limit: 12,
            total: pages * 12,
            pages,
        },
    };
}

const routineReference = {
    units: [
        { id: 3, code: "FIN", name: "การเงิน" },
        { id: 4, code: "OPS", name: "ปฏิบัติการ" },
    ],
    categories: [
        { id: 5, name: "รายงานประจำเดือน", sortOrder: 1 },
        { id: 6, name: "ตรวจสอบระบบ", sortOrder: 2 },
    ],
    employees: [{
        id: 11,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: null,
    }],
};

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

const userRoutineCapabilities = {
    ...allRoutineCapabilities,
    canReadAllTasks: false,
    canCreateTasksForOthers: false,
    canUpdateAllTasks: false,
    canDeleteAllTasks: false,
    canReadAllReferences: false,
    canReadAllSummary: false,
    canManageImports: false,
} satisfies RoutinePresentationCapabilities;

const readOnlyRoutineCapabilities = {
    ...userRoutineCapabilities,
    canCreateTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canOverrideOccurrences: false,
} satisfies RoutinePresentationCapabilities;

function mockRoutineUser(
    role: "USER" | "ADMIN",
    routineCapabilities: RoutinePresentationCapabilities = role === "ADMIN"
        ? allRoutineCapabilities
        : userRoutineCapabilities,
): void {
    mocks.useDashboardDataContext.mockReturnValue({
        user: { role, routineCapabilities },
    });
}

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: mocks.useDashboardDataContext,
}));

vi.mock("swr", () => ({ default: mocks.useSWR }));

vi.mock("next/navigation", () => ({
    useSearchParams: mocks.useSearchParams,
}));

vi.mock("@/lib/helpers/download", () => ({
    triggerDownload: mocks.triggerDownload,
}));

vi.mock("@/components/ui/section-tabs", async () => {
    return {
    SectionTabs: ({
        value,
        tabs,
        onValueChange,
    }: {
        value: string;
        tabs: Array<{
                value: string;
                label: string;
                visible?: boolean;
                content?: ReactNode;
            }>;
            onValueChange: (value: string) => void;
        }) => {
            const activeTab = tabs.find((tab) => tab.value === value && tab.visible !== false);
            const managementTab = tabs.find((tab) => tab.value === "manage" && tab.visible !== false);
            const contentTabs = activeTab === undefined
                ? managementTab ? [managementTab] : []
                : [activeTab];
            return (
            <div>
                {tabs
                    .filter((tab) => tab.visible !== false)
                    .map((tab) => (
                        <button key={tab.value} type="button" onClick={() => onValueChange(tab.value)}>{tab.label}</button>
                    ))}
                {contentTabs.map((tab) => <div key={tab.value}>{tab.content}</div>)}
            </div>
            );
        },
    };
});

vi.mock("./RoutineKpiGrid", () => ({
    RoutineKpiGrid: () => <div data-testid="routine-kpi-grid" />,
}));

vi.mock("./RoutineOccurrenceList", () => ({
    RoutineOccurrenceList: ({
        routineCapabilities,
        onEditTask,
        onPageChange,
        renderEditAction,
    }: {
        routineCapabilities?: RoutinePresentationCapabilities;
        onEditTask: (taskId: number) => void;
        onPageChange: (page: number) => void;
        renderEditAction?: (task: RoutineTaskWorkItem) => ReactNode;
    }) => (
        <div data-testid="routine-occurrence-list">
            <button type="button" onClick={() => onPageChange(2)}>
                ไปหน้ารายการ Routine ถัดไป
            </button>
            {routineCapabilities?.canUpdateTasks === true ? (
                renderEditAction ? renderEditAction({ id: 71 } as RoutineTaskWorkItem) : (
                    <button type="button" onClick={() => onEditTask(71)}>
                        แก้ไข Routine ทดสอบ
                    </button>
                )
            ) : null}
        </div>
    ),
}));

vi.mock("./RoutineTaskList", () => ({
    RoutineTaskList: ({
        search,
        categories,
        categoryId,
        onCreate,
        createAction,
        routineCapabilities,
        onSearchChange,
        onCategoryChange,
        onPageChange,
    }: {
        search: string;
        categories: Array<{ id: number; name: string }>;
        categoryId: string;
        onCreate: () => void;
        routineCapabilities?: RoutinePresentationCapabilities;
        onSearchChange: (value: string) => void;
        onCategoryChange: (value: string) => void;
        onPageChange: (page: number) => void;
        createAction?: ReactNode;
    }) => (
        <div data-testid="routine-task-list">
            <input
                aria-label="ค้นหาแม่แบบงาน"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
            />
            <label>
                หมวดหมู่งาน
                <select
                    value={categoryId}
                    onChange={(event) => onCategoryChange(event.target.value)}
                >
                    <option value="">ทุกหมวดหมู่</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                </select>
            </label>
            <button type="button" onClick={() => onPageChange(2)}>
                ไปหน้าถัดไป
            </button>
            {createAction ?? (routineCapabilities?.canCreateTasks === true ? (
                <button type="button" onClick={onCreate}>
                    สร้างแม่แบบงานทดสอบ
                </button>
            ) : null)}
        </div>
    ),
}));

describe("RoutineSection tabs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useSearchParams.mockReturnValue(new URLSearchParams());
        mocks.useSWR.mockImplementation((key: unknown) => ({
            data: key === "/api/routines/reference" ? routineReference : undefined,
            error: undefined,
            isLoading: false,
            mutate: typeof key === "string" && key.startsWith("/api/routines/tasks?")
                ? mocks.mutateTasks
                : typeof key === "string" && key.startsWith("/api/routines/summary?")
                    ? mocks.mutateSummary
                    : vi.fn(),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("does not expose the all-task tab without task.read/ALL", () => {
        mockRoutineUser("USER");

        render(<RoutineSection />);

        expect(screen.getByText("รายการของฉัน")).toBeInTheDocument();
        expect(screen.getByText("จัดการงาน")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(screen.queryByText("ตั้งค่างานประจำ")).not.toBeInTheDocument();
        expect(screen.queryByText("นำเข้าจาก Excel")).not.toBeInTheDocument();
        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=mine",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/reference",
            expect.any(Function),
        );
        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
    });

    it("keeps the operational list available when reference filters fail to load", () => {
        mockRoutineUser("USER");
        mocks.useSWR.mockImplementation((key: unknown) => ({
            data: undefined,
            error: key === "/api/routines/reference"
                ? new Error("reference unavailable")
                : undefined,
            isLoading: false,
            mutate: vi.fn(),
        }));

        render(<RoutineSection />);

        expect(screen.getByTestId("routine-occurrence-list")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent(
            "โหลดตัวเลือกหน่วยงานและหมวดหมู่งานไม่สำเร็จ",
        );
        expect(screen.getByRole("combobox", { name: "หน่วยงาน" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "หมวดหมู่งาน" })).toBeDisabled();
    });

    it("keeps a regular user in the mine view without task.read/ALL", async () => {
        mockRoutineUser("USER");

        render(<RoutineSection />);

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=mine",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
        expect(screen.queryByRole("button", { name: "รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
        expect(mocks.useSWR).not.toHaveBeenCalledWith(
            expect.stringContaining("scope=all"),
            expect.any(Function),
            expect.anything(),
        );
    });

    it("falls back to mine for a direct all-tab URL without task.read/ALL", async () => {
        mockRoutineUser("USER");
        mocks.useSearchParams.mockReturnValue(new URLSearchParams("routineTab=all&taskId=71&occurrenceId=91"));

        render(<RoutineSection />);

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=mine",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
        expect(screen.queryByRole("button", { name: "รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&taskId=71&occurrenceId=91",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
        expect(mocks.useSWR).not.toHaveBeenCalledWith(
            expect.stringContaining("scope=all"),
            expect.any(Function),
            expect.anything(),
        );
    });

    it("does not request a broad KPI without summary.read/ALL", async () => {
        mockRoutineUser("USER", {
            ...allRoutineCapabilities,
            canReadAllSummary: false,
        });

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "รายการทั้งหมด" }));

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/occurrences?scope=all&page=1&limit=12&view=tasks",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
        expect(mocks.useSWR).not.toHaveBeenCalledWith(
            "/api/routines/summary?scope=all",
            expect.any(Function),
            expect.anything(),
        );
        expect(screen.queryByTestId("routine-kpi-grid")).not.toBeInTheDocument();
    });

    it("offers an all-task Excel export to every workforce user", () => {
        mockRoutineUser("USER");

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "ส่งออก Excel รายการทั้งหมด" }));

        expect(mocks.triggerDownload).toHaveBeenCalledWith(
            "/api/routines/export?format=xlsx",
        );
    });

    it("gates the export control by canExportTasks instead of task-read access", () => {
        mockRoutineUser("USER", {
            ...allRoutineCapabilities,
            canExportTasks: false,
        });

        render(<RoutineSection />);

        expect(screen.queryByRole("button", { name: "ส่งออก Excel รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(mocks.triggerDownload).not.toHaveBeenCalled();
    });

    it("exposes broad task management from capability authority", () => {
        mockRoutineUser("ADMIN");

        render(<RoutineSection />);

        expect(screen.getByText("รายการของฉัน")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "รายการทั้งหมด" })).toBeInTheDocument();
        expect(screen.getByText("จัดการงาน")).toBeInTheDocument();
        expect(screen.getByText("นำเข้าจาก Excel")).toBeInTheDocument();
    });

    it("keeps work tabs visible while hiding capability-gated actions", () => {
        mockRoutineUser("USER", readOnlyRoutineCapabilities);

        render(<RoutineSection />);

        expect(screen.getByText("รายการของฉัน")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(screen.queryByText("จัดการงาน")).not.toBeInTheDocument();
        expect(screen.queryByText("นำเข้าจาก Excel")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "สร้างแม่แบบงานทดสอบ" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "แก้ไข Routine ทดสอบ" })).not.toBeInTheDocument();
    });

    it("keeps management and import tabs independently capability-driven", () => {
        mockRoutineUser("USER", {
            ...readOnlyRoutineCapabilities,
            canReadTasks: false,
            canManageImports: true,
            canCreateTasks: true,
        });

        render(<RoutineSection />);

        expect(screen.queryByRole("button", { name: "รายการของฉัน" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "จัดการงาน" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "นำเข้าจาก Excel" })).toBeInTheDocument();
        expect(mocks.useSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.objectContaining({ keepPreviousData: true }));
    });

    it("lets a configured USER with broad capabilities use Routine actions", () => {
        mockRoutineUser("USER", allRoutineCapabilities);

        render(<RoutineSection />);

        expect(screen.getByText("จัดการงาน")).toBeInTheDocument();
        expect(screen.getByText("นำเข้าจาก Excel")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));
        expect(screen.getByRole("button", { name: "สร้างแม่แบบงาน" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "รายการทั้งหมด" }));
        expect(screen.getByRole("button", { name: "แก้ไข Routine" })).toBeInTheDocument();
    });

    it.each(["USER", "ADMIN"] as const)(
        "keeps configured %s presentation role-neutral when grants are identical",
        (role) => {
            mockRoutineUser(role, allRoutineCapabilities);

            render(<RoutineSection />);

            expect(screen.getByRole("button", { name: "รายการของฉัน" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "รายการทั้งหมด" })).toBeInTheDocument();
        },
    );

    it("falls back from a stale import tab URL when import capability is absent", () => {
        mockRoutineUser("USER");
        mocks.useSearchParams.mockReturnValue(new URLSearchParams("routineTab=import"));

        render(<RoutineSection />);

        expect(screen.queryByText("นำเข้าจาก Excel")).not.toBeInTheDocument();
        expect(screen.getByTestId("routine-occurrence-list")).toBeInTheDocument();
    });

    it("fails closed without the Routine module-entry capability", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        render(<RoutineSection />);

        expect(screen.queryByText("รายการของฉัน")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ส่งออก Excel รายการทั้งหมด" })).not.toBeInTheDocument();
        expect(mocks.useSWR).toHaveBeenCalledWith(
            null,
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
        expect(mocks.useSWR).not.toHaveBeenCalledWith(
            "/api/routines/reference",
            expect.any(Function),
        );
    });

    it("opens create in a dialog while keeping the management list mounted", async () => {
        mockRoutineUser("ADMIN");

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));
        fireEvent.click(screen.getByRole("button", { name: "สร้างแม่แบบงาน" }));

        expect(screen.getByTestId("routine-task-list")).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "สร้างแม่แบบงานประจำ" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "สร้างแม่แบบงานประจำ" })).not.toBeInTheDocument());
        expect(screen.getByTestId("routine-task-list")).toBeInTheDocument();
    });

    it("does not resurrect a routine tab after its capability is restored", () => {
        let capabilities: RoutinePresentationCapabilities = allRoutineCapabilities;

        function CapabilityHarness() {
            const [, rerender] = useState(0);

            function updateCapabilities(nextCapabilities: RoutinePresentationCapabilities): void {
                capabilities = nextCapabilities;
                rerender((value) => value + 1);
            }

            mocks.useDashboardDataContext.mockReturnValue({
                user: { role: "USER", routineCapabilities: capabilities },
            });

            return (
                <>
                    <button
                        type="button"
                        onClick={() => updateCapabilities({
                            ...allRoutineCapabilities,
                            canCreateTasks: false,
                            canUpdateTasks: false,
                            canDeleteTasks: false,
                        })}
                    >
                        ถอนสิทธิ์จัดการ Routine
                    </button>
                    <button
                        type="button"
                        onClick={() => updateCapabilities(allRoutineCapabilities)}
                    >
                        คืนสิทธิ์จัดการ Routine
                    </button>
                    <RoutineSection />
                </>
            );
        }

        render(<CapabilityHarness />);
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));
        expect(screen.getByTestId("routine-task-list")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ถอนสิทธิ์จัดการ Routine" }));
        expect(screen.getByTestId("routine-occurrence-list")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "คืนสิทธิ์จัดการ Routine" }));
        expect(screen.getByTestId("routine-occurrence-list")).toBeInTheDocument();
        expect(screen.queryByTestId("routine-task-list")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));
        expect(screen.getByTestId("routine-task-list")).toBeInTheDocument();
    });

    it("closes after create success and refreshes the current list and summary", async () => {
        mockRoutineUser("USER");
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ task: { id: 81 } }), { status: 201 }),
        );
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));
        fireEvent.click(screen.getByRole("button", { name: "สร้างแม่แบบงาน" }));
        fireEvent.change(screen.getByDisplayValue("เลือกหน่วยงาน"), {
            target: { value: "3" },
        });
        fireEvent.change(screen.getByDisplayValue("เลือกหมวดหมู่"), {
            target: { value: "5" },
        });
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), {
            target: { value: "ตรวจสอบระบบรายเดือน" },
        });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกงานของฉัน" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "สร้างแม่แบบงานของฉัน" })).not.toBeInTheDocument());
        expect(screen.getByTestId("routine-task-list")).toBeInTheDocument();
        expect(mocks.mutateTasks).toHaveBeenCalledTimes(1);
        expect(mocks.mutateSummary).toHaveBeenCalledTimes(1);
    });

    it("opens operational edit in a dialog while keeping the operational list mounted", () => {
        mockRoutineUser("ADMIN");

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "รายการทั้งหมด" }));
        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));

        expect(screen.getByTestId("routine-occurrence-list")).toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "แก้ไข Routine" })).toBeInTheDocument();
    });

    it("loads the master task detail for a regular employee's edit action", async () => {
        mockRoutineUser("USER");

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "แก้ไข Routine" }));

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/tasks/71",
            expect.any(Function),
        ));
        expect(screen.getByRole("dialog", { name: "แก้ไข Routine" })).toBeInTheDocument();
    });

    it("exposes only current and future timing options in the operational filter", () => {
        mockRoutineUser("USER");

        render(<RoutineSection />);

        const timingFilter = screen.getByRole("combobox", { name: "ช่วงเวลา" });
        expect(within(timingFilter).queryByRole("option", { name: "เกินกำหนด" })).not.toBeInTheDocument();
        expect(within(timingFilter).getByRole("option", { name: "ทุกช่วงเวลา" })).toBeInTheDocument();
        expect(within(timingFilter).getByRole("option", { name: "ถึงกำหนดวันนี้" })).toBeInTheDocument();
        expect(within(timingFilter).getByRole("option", { name: "ใกล้ถึงกำหนด" })).toBeInTheDocument();
        expect(within(timingFilter).getByRole("option", { name: "ยังไม่ถึงกำหนด" })).toBeInTheDocument();
    });

    it("requests all tasks for the management list", () => {
        mockRoutineUser("ADMIN");

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));

        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/tasks?activeOnly=0&page=1&limit=20",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
    });

    it("requests the KPI summary for the active admin operational scope", async () => {
        mockRoutineUser("ADMIN");

        render(<RoutineSection />);

        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=mine",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
        fireEvent.click(screen.getByRole("button", { name: "รายการทั้งหมด" }));

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=all",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/occurrences?scope=all&page=1&limit=12&view=tasks",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
    });

    it("opens an admin deep link with the all-scope KPI", async () => {
        mockRoutineUser("ADMIN");
        mocks.useSearchParams.mockReturnValue(new URLSearchParams("taskId=71&occurrenceId=91"));

        render(<RoutineSection />);

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=all",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/occurrences?scope=all&page=1&limit=12&view=tasks&taskId=71&occurrenceId=91",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        ));
    });

    it("resets the operational page when an external scope changes while mounted", async () => {
        mockRoutineUser("ADMIN");
        mocks.useSearchParams.mockReturnValue(new URLSearchParams("routineTab=mine"));

        const view = render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        expect(getLatestOccurrenceKey()).toContain("scope=mine&page=2");

        mocks.useSearchParams.mockReturnValue(new URLSearchParams("routineTab=all"));
        view.rerender(<RoutineSection />);

        await waitFor(() => expect(getOccurrenceKeys()).toContain(
            "/api/routines/occurrences?scope=all&page=1&limit=12&view=tasks",
        ));
    });

    it("resets deep-link identity to page one and rejects stale previous-query responses", () => {
        mockRoutineUser("USER");
        mocks.useSearchParams.mockReturnValue(new URLSearchParams("taskId=71"));

        const view = render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        const previousQueryKey = getLatestOccurrenceKey();
        expect(previousQueryKey).toContain("page=2&limit=12&view=tasks&taskId=71");

        mocks.useSearchParams.mockReturnValue(new URLSearchParams("taskId=72"));
        view.rerender(<RoutineSection />);
        expect(getLatestOccurrenceKey()).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&taskId=72",
        );

        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        const currentQueryKey = getLatestOccurrenceKey();
        const currentQuerySuccess = getOccurrenceSuccess(currentQueryKey);
        expect(currentQueryKey).toContain("page=2&limit=12&view=tasks&taskId=72");

        act(() => {
            currentQuerySuccess(routineResponse(1), previousQueryKey);
        });

        expect(getLatestOccurrenceKey()).toBe(currentQueryKey);
    });

    it("clamps an authoritative empty page and keeps the clamped page after growth", () => {
        mockRoutineUser("USER");
        render(<RoutineSection />);

        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        const pageTwoQueryKey = getLatestOccurrenceKey();
        const pageTwoSuccess = getOccurrenceSuccess(pageTwoQueryKey);

        act(() => {
            pageTwoSuccess(routineResponse(1), pageTwoQueryKey);
        });

        const pageOneQueryKey = getLatestOccurrenceKey();
        expect(pageOneQueryKey).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks",
        );
        const pageOneSuccess = getOccurrenceSuccess(pageOneQueryKey);

        act(() => {
            pageOneSuccess(routineResponse(3), pageOneQueryKey);
        });

        expect(getLatestOccurrenceKey()).toBe(pageOneQueryKey);
    });

    it("combines operational filters and resets pagination when each filter changes", () => {
        vi.useFakeTimers();
        mockRoutineUser("USER");

        const occurrenceKeys = (): string[] => (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
            .map(([key]) => typeof key === "string" ? key : "")
            .filter((key) => key.includes("/api/routines/occurrences"));

        render(<RoutineSection />);

        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        expect(occurrenceKeys()).toContain(
            "/api/routines/occurrences?scope=mine&page=2&limit=12&view=tasks",
        );

        fireEvent.change(screen.getByRole("combobox", { name: "หน่วยงาน" }), {
            target: { value: "3" },
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&unitId=3",
        );

        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=2&limit=12&view=tasks&unitId=3",
        );

        fireEvent.change(screen.getByRole("combobox", { name: "หมวดหมู่งาน" }), {
            target: { value: "5" },
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&unitId=3&categoryId=5",
        );

        fireEvent.change(screen.getByRole("combobox", { name: "ช่วงเวลา" }), {
            target: { value: "DUE_SOON" },
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&timingStatus=DUE_SOON&unitId=3&categoryId=5",
        );

        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        fireEvent.change(screen.getByRole("searchbox", { name: "ค้นหารายการ" }), {
            target: { value: "VAT" },
        });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&search=VAT&timingStatus=DUE_SOON&unitId=3&categoryId=5",
        );
        vi.useRealTimers();
    });

    it("adds task category filtering and resets task pagination", () => {
        mockRoutineUser("ADMIN");

        const taskKeys = (): string[] => (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
            .map(([key]) => typeof key === "string" ? key : "")
            .filter((key) => key.includes("/api/routines/tasks"));

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));

        const taskList = screen.getByTestId("routine-task-list");
        fireEvent.click(within(taskList).getByRole("button", { name: "ไปหน้าถัดไป" }));
        expect(taskKeys()).toContain("/api/routines/tasks?activeOnly=0&page=2&limit=20");

        fireEvent.change(within(taskList).getByRole("combobox", { name: "หมวดหมู่งาน" }), {
            target: { value: "5" },
        });
        expect(taskKeys().at(-1)).toBe(
            "/api/routines/tasks?activeOnly=0&page=1&limit=20&categoryId=5",
        );
    });

    it("debounces task settings search, resets pagination, and clears the query", () => {
        vi.useFakeTimers();
        mockRoutineUser("ADMIN");

        const taskKeys = (): string[] => (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
            .map(([key]) => typeof key === "string" ? key : "")
            .filter((key) => key.includes("/api/routines/tasks"));

        render(<RoutineSection />);
        fireEvent.click(screen.getByRole("button", { name: "จัดการงาน" }));

        const searchInput = screen.getByRole("textbox", { name: "ค้นหาแม่แบบงาน" });
        fireEvent.click(within(screen.getByTestId("routine-task-list")).getByRole("button", { name: "ไปหน้าถัดไป" }));
        expect(taskKeys()).toContain("/api/routines/tasks?activeOnly=0&page=2&limit=20");

        fireEvent.change(searchInput, { target: { value: "ต" } });
        fireEvent.change(searchInput, { target: { value: "ตร" } });
        fireEvent.change(searchInput, { target: { value: "ตรวจสอบ" } });
        expect(taskKeys().some((key) => key.includes("search="))).toBe(false);
        expect(taskKeys()).toContain("/api/routines/tasks?activeOnly=0&page=1&limit=20");

        act(() => {
            vi.advanceTimersByTime(299);
        });
        expect(taskKeys().some((key) => key.includes("search="))).toBe(false);

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(taskKeys()).toContain("/api/routines/tasks?activeOnly=0&page=1&limit=20&search=%E0%B8%95%E0%B8%A3%E0%B8%A7%E0%B8%88%E0%B8%AA%E0%B8%AD%E0%B8%9A");

        fireEvent.change(searchInput, { target: { value: "" } });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(taskKeys().at(-1)).toBe("/api/routines/tasks?activeOnly=0&page=1&limit=20");
        vi.useRealTimers();
    });

    it("debounces the operational routine search before changing the request key", () => {
        vi.useFakeTimers();
        mockRoutineUser("USER");

        const occurrenceKeys = (): string[] => (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
            .map(([key]) => typeof key === "string" ? key : "")
            .filter((key) => key.includes("/api/routines/occurrences"));

        render(<RoutineSection />);

        const searchInput = screen.getByPlaceholderText("ค้นหาชื่อรายการ หน่วยงาน หรือหมวดหมู่");
        fireEvent.change(searchInput, { target: { value: "ตรวจ" } });
        fireEvent.change(searchInput, { target: { value: "ตรวจสอบ" } });
        expect(occurrenceKeys().some((key) => key.includes("search="))).toBe(false);

        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(occurrenceKeys()).toContain("/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&search=%E0%B8%95%E0%B8%A3%E0%B8%A7%E0%B8%88%E0%B8%AA%E0%B8%AD%E0%B8%9A");

        fireEvent.click(
            screen.getByRole("button", {
                name: "ล้างคำค้นหารายการ Routine",
            }),
        );
        expect(searchInput).toHaveValue("");
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks",
        );
        vi.useRealTimers();
    });
});
