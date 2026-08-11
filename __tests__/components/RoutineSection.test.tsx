import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { RoutineSection } from "@/components/dashboard/sections/RoutineSection";

const mocks = vi.hoisted(() => ({
    useDashboardDataContext: vi.fn(),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    useSWR: vi.fn((_key: unknown) => ({
        data: undefined as unknown,
        error: undefined as Error | undefined,
        isLoading: false,
        mutate: vi.fn(),
    })),
}));

const routineReference = {
    units: [
        { id: 3, code: "FIN", name: "การเงิน" },
        { id: 4, code: "OPS", name: "ปฏิบัติการ" },
    ],
    categories: [
        { id: 5, name: "รายงานประจำเดือน", sortOrder: 1 },
        { id: 6, name: "ตรวจสอบระบบ", sortOrder: 2 },
    ],
    employees: [],
};

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: mocks.useDashboardDataContext,
}));

vi.mock("swr", () => ({ default: mocks.useSWR }));

vi.mock("next/navigation", () => ({
    useSearchParams: mocks.useSearchParams,
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
            const managementTab = tabs.find((tab) => tab.value === "settings" && tab.visible !== false);
            const contentTabs = activeTab === undefined
                ? managementTab ? [managementTab] : []
                : activeTab.value === managementTab?.value
                    ? [activeTab]
                    : managementTab ? [activeTab, managementTab] : [activeTab];
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

vi.mock("@/components/dashboard/routine/RoutineKpiGrid", () => ({
    RoutineKpiGrid: () => <div data-testid="routine-kpi-grid" />,
}));

vi.mock("@/components/dashboard/routine/RoutineOccurrenceList", () => ({
    RoutineOccurrenceList: ({
        onPageChange,
    }: {
        onPageChange: (page: number) => void;
    }) => (
        <div data-testid="routine-occurrence-list">
            <button type="button" onClick={() => onPageChange(2)}>
                ไปหน้ารายการ Routine ถัดไป
            </button>
        </div>
    ),
}));

vi.mock("@/components/dashboard/routine/RoutineTaskList", () => ({
    RoutineTaskList: ({
        search,
        categories,
        categoryId,
        onSearchChange,
        onCategoryChange,
        onPageChange,
    }: {
        search: string;
        categories: Array<{ id: number; name: string }>;
        categoryId: string;
        onSearchChange: (value: string) => void;
        onCategoryChange: (value: string) => void;
        onPageChange: (page: number) => void;
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
            mutate: vi.fn(),
        }));
    });

    it("does not expose admin tabs to a regular user", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "USER" },
        });

        render(<RoutineSection />);

        expect(screen.getByText("รายการของฉัน")).toBeInTheDocument();
        expect(screen.getByText("จัดการงานของฉัน")).toBeInTheDocument();
        expect(screen.queryByText("รายการทั้งหมด (Admin)")).not.toBeInTheDocument();
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
    });

    it("keeps the operational list available when reference filters fail to load", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "USER" },
        });
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

    it("exposes task settings and all-occurrence tabs to an admin", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        render(<RoutineSection />);

        expect(screen.getByText("รายการของฉัน")).toBeInTheDocument();
        expect(screen.getByText("รายการทั้งหมด (Admin)")).toBeInTheDocument();
        expect(screen.getByText("ตั้งค่างานประจำ")).toBeInTheDocument();
        expect(screen.getByText("นำเข้าจาก Excel")).toBeInTheDocument();
    });

    it("requests all tasks for the admin settings list", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        render(<RoutineSection />);

        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/tasks?activeOnly=0&page=1&limit=20",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
    });

    it("requests the KPI summary for the active admin operational scope", async () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        render(<RoutineSection />);

        expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=mine",
            expect.any(Function),
            expect.objectContaining({ keepPreviousData: true }),
        );
        fireEvent.click(screen.getByRole("button", { name: "รายการทั้งหมด (Admin)" }));

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
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });
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

    it("combines operational filters and resets pagination when each filter changes", () => {
        vi.useFakeTimers();
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "USER" },
        });

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
            target: { value: "OVERDUE" },
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&timingStatus=OVERDUE&unitId=3&categoryId=5",
        );

        fireEvent.click(screen.getByRole("button", { name: "ไปหน้ารายการ Routine ถัดไป" }));
        fireEvent.change(screen.getByRole("searchbox", { name: "ค้นหารายการ" }), {
            target: { value: "VAT" },
        });
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(occurrenceKeys().at(-1)).toBe(
            "/api/routines/occurrences?scope=mine&page=1&limit=12&view=tasks&search=VAT&timingStatus=OVERDUE&unitId=3&categoryId=5",
        );
        vi.useRealTimers();
    });

    it("adds task category filtering and resets task pagination", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        const taskKeys = (): string[] => (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
            .map(([key]) => typeof key === "string" ? key : "")
            .filter((key) => key.includes("/api/routines/tasks"));

        render(<RoutineSection />);

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
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        const taskKeys = (): string[] => (mocks.useSWR.mock.calls as unknown as Array<[unknown]>)
            .map(([key]) => typeof key === "string" ? key : "")
            .filter((key) => key.includes("/api/routines/tasks"));

        render(<RoutineSection />);

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
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "USER" },
        });

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
