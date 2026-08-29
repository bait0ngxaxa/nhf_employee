import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveManagementSection } from "@/components/dashboard/sections/LeaveManagementSection";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
}));

vi.mock("@/components/ui/section-tabs", () => ({
    SectionTabs: ({
        tabs,
    }: {
        tabs: Array<{ value: string; label: string; visible?: boolean; content: ReactNode }>;
    }) => (
        <div data-testid="leave-tabs">
            {tabs
                .filter((tab) => tab.visible !== false)
                .map((tab) => <button key={tab.value} type="button">{tab.label}</button>)}
        </div>
    ),
}));

vi.mock("@/components/dashboard/leave/EmployeeLeaveDashboard", () => ({
    EmployeeLeaveDashboard: () => <div data-testid="my-leave" />,
}));

vi.mock("@/components/dashboard/leave/ManagerApprovalDashboard", () => ({
    ManagerApprovalDashboard: () => <div data-testid="normal-approval" />,
}));

vi.mock("@/components/dashboard/leave/AdminLeaveRecoveryDashboard", () => ({
    AdminLeaveRecoveryDashboard: () => <div data-testid="admin-recovery" />,
}));

vi.mock("@/components/dashboard/leave/ApproverManagement", () => ({
    ApproverManagement: () => <div data-testid="approver-management" />,
}));

vi.mock("@/components/dashboard/leave/LeaveReportsDashboard", () => ({
    LeaveReportsDashboard: () => <div data-testid="leave-reports" />,
}));

function mockDashboardUser(user: {
    role: "USER" | "ADMIN";
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
}): void {
    vi.mocked(useDashboardDataContext).mockReturnValue({
        status: "authenticated",
        user,
        isAdmin: user.role === "ADMIN",
        employeeStats: { total: 0, active: 0, admin: 0, academic: 0 },
        refreshTrigger: 0,
        handleEmployeeAdded: vi.fn(),
        availableMenuGroups: [],
    });
}

describe("LeaveManagementSection permissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("hides both approval and recovery tabs for a normal employee", async () => {
        mockDashboardUser({ role: "USER", isManager: false, canApproveLeave: false });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("my-leave")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
    });

    it("shows only normal approval for a non-admin approver", async () => {
        mockDashboardUser({ role: "USER", isManager: true, canApproveLeave: true });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "อนุมัติการลา" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
    });

    it("shows only recovery for an admin who is not an approver", async () => {
        mockDashboardUser({
            role: "ADMIN",
            isManager: false,
            canApproveLeave: false,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
    });

    it("shows both workflows for an admin exception approver without subordinates", async () => {
        mockDashboardUser({
            role: "ADMIN",
            isManager: false,
            canApproveLeave: true,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "อนุมัติการลา" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
    });
});
