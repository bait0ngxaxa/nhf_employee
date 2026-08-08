import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { RoutineSection } from "@/components/dashboard/sections/RoutineSection";

const mocks = vi.hoisted(() => ({
    useDashboardDataContext: vi.fn(),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    useSWR: vi.fn(() => ({
        data: undefined,
        error: undefined,
        isLoading: false,
        mutate: vi.fn(),
    })),
}));

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
    RoutineOccurrenceList: () => <div data-testid="routine-occurrence-list" />,
}));

vi.mock("@/components/dashboard/routine/RoutineTaskList", () => ({
    RoutineTaskList: ({
        search,
        onSearchChange,
        onPageChange,
    }: {
        search: string;
        onSearchChange: (value: string) => void;
        onPageChange: (page: number) => void;
    }) => (
        <div data-testid="routine-task-list">
            <input
                aria-label="ค้นหาแม่แบบงาน"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
            />
            <button type="button" onClick={() => onPageChange(2)}>
                ไปหน้าถัดไป
            </button>
        </div>
    ),
}));

describe("RoutineSection tabs", () => {
    beforeEach(() => {
        mocks.useSearchParams.mockReturnValue(new URLSearchParams());
        mocks.useSWR.mockReturnValue({
            data: undefined,
            error: undefined,
            isLoading: false,
            mutate: vi.fn(),
        });
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
        );
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
        );
        fireEvent.click(screen.getByRole("button", { name: "รายการทั้งหมด (Admin)" }));

        await waitFor(() => expect(mocks.useSWR).toHaveBeenCalledWith(
            "/api/routines/summary?scope=all",
            expect.any(Function),
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
        ));
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
        fireEvent.click(screen.getByRole("button", { name: "ไปหน้าถัดไป" }));
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
