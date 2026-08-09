import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionManagementSection } from "@/components/dashboard/sections/SessionManagementSection";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { useSessionManagement } from "@/components/dashboard/session-management/useSessionManagement";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardUIContext: vi.fn(),
}));

vi.mock("@/components/dashboard/session-management/useSessionManagement", () => ({
    useSessionManagement: vi.fn(),
}));

describe("SessionManagementSection", () => {
    it("renders a layout-aware skeleton instead of a loading spinner", () => {
        vi.mocked(useDashboardUIContext).mockReturnValue({
            handleSignOut: vi.fn(),
        } as never);
        vi.mocked(useSessionManagement).mockReturnValue({
            sessions: [],
            currentSession: null,
            otherSessions: [],
            error: undefined,
            isLoading: true,
            isValidating: true,
            revokingId: null,
            isRevokingOthers: false,
            confirmAction: null,
            setConfirmAction: vi.fn(),
            refresh: vi.fn(),
            handleConfirmAction: vi.fn(),
        });

        render(<SessionManagementSection />);

        expect(
            screen.getByRole("status", { name: "กำลังโหลดข้อมูลเซสชัน" }),
        ).toBeInTheDocument();
        expect(screen.queryByText("กำลังโหลดข้อมูลเซสชัน...")).not.toBeInTheDocument();
    });
});
