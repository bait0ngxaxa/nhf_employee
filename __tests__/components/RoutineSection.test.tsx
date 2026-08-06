import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { RoutineSection } from "@/components/dashboard/sections/RoutineSection";

const mocks = vi.hoisted(() => ({
    useDashboardDataContext: vi.fn(),
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
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/section-tabs", async () => {
    return {
        SectionTabs: ({
            tabs,
        }: {
            tabs: Array<{
                value: string;
                label: string;
                visible?: boolean;
                content?: ReactNode;
            }>;
        }) => (
            <div>
                {tabs
                    .filter((tab) => tab.visible !== false)
                    .map((tab) => (
                        <span key={tab.value}>{tab.label}</span>
                    ))}
                {tabs.find((tab) => tab.value === "settings")?.content}
            </div>
        ),
    };
});

vi.mock("@/components/dashboard/routine/RoutineKpiGrid", () => ({
    RoutineKpiGrid: () => <div data-testid="routine-kpi-grid" />,
}));

vi.mock("@/components/dashboard/routine/RoutineOccurrenceList", () => ({
    RoutineOccurrenceList: () => <div data-testid="routine-occurrence-list" />,
}));

vi.mock("@/components/dashboard/routine/RoutineTaskList", () => ({
    RoutineTaskList: () => <div data-testid="routine-task-list" />,
}));

describe("RoutineSection tabs", () => {
    beforeEach(() => {
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
});
