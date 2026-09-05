import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveManagementSection } from "./LeaveManagementSection";
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

vi.mock("./EmployeeLeaveDashboard", () => ({
    EmployeeLeaveDashboard: () => <div data-testid="my-leave" />,
}));

vi.mock("./ManagerApprovalDashboard", () => ({
    ManagerApprovalDashboard: () => <div data-testid="normal-approval" />,
}));

vi.mock("./AdminLeaveRecoveryDashboard", () => ({
    AdminLeaveRecoveryDashboard: () => <div data-testid="admin-recovery" />,
}));

vi.mock("./ApproverManagement", () => ({
    ApproverManagement: () => <div data-testid="approver-management" />,
}));

vi.mock("./LeaveReportsDashboard", () => ({
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
        availableMenuGroups: [],
    });
}

describe("LeaveManagementSection permissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("hides approval, recovery, and report tabs for a normal employee", async () => {
        mockDashboardUser({
            role: "USER",
            isManager: false,
            canApproveLeave: false,
            canViewLeaveReports: false,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("my-leave")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รีพอร์ต" })).not.toBeInTheDocument();
    });

    it("shows approval and reports for an organizational manager", async () => {
        mockDashboardUser({
            role: "USER",
            isManager: true,
            canApproveLeave: true,
            canViewLeaveReports: true,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "อนุมัติการลา" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "รีพอร์ต" })).toBeInTheDocument();
    });

    it("shows reports without approval for a historical approver", async () => {
        mockDashboardUser({
            role: "USER",
            isManager: false,
            canApproveLeave: false,
            canViewLeaveReports: true,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "รีพอร์ต" })).toBeInTheDocument();
    });

    it("shows only recovery for an admin who is not an approver", async () => {
        mockDashboardUser({
            role: "ADMIN",
            isManager: false,
            canApproveLeave: false,
            canViewLeaveReports: false,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รีพอร์ต" })).not.toBeInTheDocument();
    });

    it("shows recovery and reports without approval for an admin with historical approval", async () => {
        mockDashboardUser({
            role: "ADMIN",
            isManager: false,
            canApproveLeave: false,
            canViewLeaveReports: true,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "รีพอร์ต" })).toBeInTheDocument();
    });

    it("shows both workflows for an admin exception approver without subordinates", async () => {
        mockDashboardUser({
            role: "ADMIN",
            isManager: false,
            canApproveLeave: true,
            canViewLeaveReports: false,
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "อนุมัติการลา" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รีพอร์ต" })).not.toBeInTheDocument();
    });
});
