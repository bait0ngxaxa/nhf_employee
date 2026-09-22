import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveManagementSection } from "./LeaveManagementSection";
import { useDashboardDataContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import type { LeavePresentationCapabilities } from "../../application/types";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
}));

vi.mock("@/components/ui/section-tabs", () => ({
    SectionTabs: ({
        value,
        tabs,
    }: {
        value: string;
        tabs: Array<{ value: string; label: string; visible?: boolean; content: ReactNode }>;
    }) => (
        <div
            data-testid="leave-tabs"
            data-active-tab={value}
            data-visible-tabs={tabs
                .filter((tab) => tab.visible !== false)
                .map((tab) => tab.value)
                .join(",")}
        >
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

const DEFAULT_LEAVE_CAPABILITIES: LeavePresentationCapabilities = {
    canReadOwnRequests: true,
    canReadAssignedApprovals: true,
    canCreateOwnRequests: true,
    canCancelOwnRequests: true,
    canApproveAssignedRequests: true,
    canDecideAssignedCancellations: true,
    canRequestOwnNotTaken: true,
    canConfirmAssignedNotTaken: true,
    canManageApprovers: false,
    canManageRecovery: false,
};

function mockDashboardUser(user: {
    role: "USER" | "ADMIN";
    isManager?: boolean;
    canApproveLeave?: boolean;
    canViewLeaveReports?: boolean;
    leaveCapabilities?: LeavePresentationCapabilities;
}): void {
    vi.mocked(useDashboardDataContext).mockReturnValue({
        status: "authenticated",
        user: {
            ...user,
            leaveCapabilities: user.leaveCapabilities ?? DEFAULT_LEAVE_CAPABILITIES,
        },
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
            expect(screen.getByRole("button", { name: "วันลาของฉัน" })).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รีพอร์ต" })).not.toBeInTheDocument();
    });

    it("renders the capability-filtered tabs when my-leave is unavailable", () => {
        mockDashboardUser({
            role: "ADMIN",
            canApproveLeave: false,
            canViewLeaveReports: true,
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canReadOwnRequests: false,
                canManageRecovery: true,
            },
        });

        render(<LeaveManagementSection defaultTab="my-leave" />);

        const tabs = screen.getByTestId("leave-tabs");
        expect(tabs).toHaveAttribute("data-active-tab", "recovery");
        expect(tabs).toHaveAttribute("data-visible-tabs", "recovery,reports");
        expect(screen.queryByTestId("my-leave")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "รีพอร์ต" })).toBeInTheDocument();
    });

    it("keeps a visible default tab active without changing deep-link ownership", () => {
        mockDashboardUser({
            role: "USER",
            isManager: true,
            canApproveLeave: true,
            canViewLeaveReports: true,
        });

        render(<LeaveManagementSection defaultTab="reports" />);

        expect(screen.getByTestId("leave-tabs")).toHaveAttribute(
            "data-active-tab",
            "reports",
        );
    });

    it("keeps the server tab structure identical during initial hydration", async () => {
        mockDashboardUser({
            role: "USER",
            isManager: true,
            canApproveLeave: true,
            canViewLeaveReports: true,
        });

        const element = <LeaveManagementSection defaultTab="reports" />;
        const serverMarkup = renderToString(element);
        const container = document.createElement("div");
        container.innerHTML = serverMarkup;
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const root = hydrateRoot(container, element);

        await act(async () => {
            await Promise.resolve();
        });

        const hydrationErrors = consoleError.mock.calls.filter((call) =>
            call.some((value) => /hydration|did not match/i.test(String(value))),
        );
        expect(hydrationErrors).toHaveLength(0);
        expect(container.innerHTML).toBe(serverMarkup);
        expect(container.querySelector("[data-testid='leave-tabs']"))
            .toHaveAttribute("data-active-tab", "reports");

        root.unmount();
        consoleError.mockRestore();
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

    it("shows recovery only when recovery capability is projected", async () => {
        mockDashboardUser({
            role: "ADMIN",
            isManager: false,
            canApproveLeave: false,
            canViewLeaveReports: false,
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canReadOwnRequests: false,
                canManageRecovery: true,
            },
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
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canReadOwnRequests: false,
                canManageRecovery: true,
            },
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
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canManageRecovery: true,
            },
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByTestId("leave-tabs")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "อนุมัติการลา" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "รีพอร์ต" })).not.toBeInTheDocument();
    });

    it("requires both assigned-read capability and the existing relationship hint for approvals", async () => {
        mockDashboardUser({
            role: "USER",
            canApproveLeave: false,
            leaveCapabilities: DEFAULT_LEAVE_CAPABILITIES,
        });

        const { rerender } = render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "วันลาของฉัน" })).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();

        mockDashboardUser({
            role: "USER",
            canApproveLeave: true,
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canReadAssignedApprovals: false,
            },
        });
        rerender(<LeaveManagementSection />);

        expect(screen.queryByRole("button", { name: "อนุมัติการลา" })).not.toBeInTheDocument();
    });

    it("shows approver settings for an explicitly granted USER without showing recovery", async () => {
        mockDashboardUser({
            role: "USER",
            canApproveLeave: false,
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canManageApprovers: true,
                canManageRecovery: false,
            },
        });

        render(<LeaveManagementSection />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "จัดการผู้อนุมัติ" })).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
    });

    it("shows recovery for a configured USER and hides it for an ADMIN without recovery capability", async () => {
        mockDashboardUser({
            role: "USER",
            canApproveLeave: false,
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canManageRecovery: true,
            },
        });

        const { rerender } = render(<LeaveManagementSection />);
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "กู้คืนรายการลา" })).toBeInTheDocument();
        });

        mockDashboardUser({
            role: "ADMIN",
            canApproveLeave: false,
            leaveCapabilities: {
                ...DEFAULT_LEAVE_CAPABILITIES,
                canManageRecovery: false,
            },
        });
        rerender(<LeaveManagementSection />);
        expect(screen.queryByRole("button", { name: "กู้คืนรายการลา" })).not.toBeInTheDocument();
    });
});
