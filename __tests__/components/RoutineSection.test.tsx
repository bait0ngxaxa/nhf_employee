import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
            tabs: Array<{ value: string; label: string; visible?: boolean }>;
        }) => (
            <div>
                {tabs
                    .filter((tab) => tab.visible !== false)
                    .map((tab) => (
                        <span key={tab.value}>{tab.label}</span>
                    ))}
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

        expect(screen.getByText("งานของฉัน")).toBeInTheDocument();
        expect(screen.queryByText("งานทั้งหมด (Admin)")).not.toBeInTheDocument();
        expect(screen.queryByText("ตั้งค่างานประจำ")).not.toBeInTheDocument();
        expect(screen.queryByText("นำเข้าจาก Excel")).not.toBeInTheDocument();
    });

    it("exposes task settings and all-occurrence tabs to an admin", () => {
        mocks.useDashboardDataContext.mockReturnValue({
            user: { role: "ADMIN" },
        });

        render(<RoutineSection />);

        expect(screen.getByText("งานของฉัน")).toBeInTheDocument();
        expect(screen.getByText("งานทั้งหมด (Admin)")).toBeInTheDocument();
        expect(screen.getByText("ตั้งค่างานประจำ")).toBeInTheDocument();
        expect(screen.getByText("นำเข้าจาก Excel")).toBeInTheDocument();
    });
});
