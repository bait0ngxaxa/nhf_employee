import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardProvider } from "@/components/dashboard/context/dashboard/DashboardProvider";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import type { AuthenticatedUser } from "@/modules/auth/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";

const navigationMocks = vi.hoisted(() => ({
    pathname: "/dashboard",
    router: {
        push: vi.fn(),
        replace: vi.fn(),
    },
    user: {
        id: "employee-1",
        name: "สมชาย ใจดี",
        role: "EMPLOYEE",
    } as AuthenticatedUser,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => navigationMocks.router,
    usePathname: () => navigationMocks.pathname,
}));

vi.mock("@/modules/stock/client", () => ({
    clearStockBrowseCart: vi.fn(),
}));

vi.mock("@/modules/auth/client", () => ({
    useAuth: () => ({
        user: navigationMocks.user,
        status: "authenticated",
        signOut: vi.fn(),
    }),
}));

const routineCapabilities = {
    canReadTasks: true,
    canCreateTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canReadOccurrences: false,
    canOverrideOccurrences: false,
    canReassignOccurrences: false,
    canChangeOccurrenceDueDate: false,
    canManageImports: false,
};

const stockCapabilities = {
    canReadCatalog: true,
    canReadOwnRequests: true,
    canReadAllRequests: true,
    canCreateRequests: true,
    canCancelOwnRequests: true,
    canCancelAnyRequests: true,
    canProcessRequests: true,
    canManageInventory: true,
    canExportReports: true,
};

const noLeaveCapabilities = {
    canReadOwnRequests: false,
    canReadAssignedApprovals: false,
    canCreateOwnRequests: false,
    canCancelOwnRequests: false,
    canApproveAssignedRequests: false,
    canDecideAssignedCancellations: false,
    canRequestOwnNotTaken: false,
    canConfirmAssignedNotTaken: false,
    canManageApprovers: false,
} as const;

const employeeReadCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: false,
    canUpdateEmployees: false,
    canDeleteEmployees: false,
    canImportEmployees: false,
    canExportEmployees: true,
} satisfies EmployeePresentationCapabilities;

const employeeCreateCapabilities = {
    ...employeeReadCapabilities,
    canCreateEmployees: true,
} satisfies EmployeePresentationCapabilities;

const employeeImportCapabilities = {
    ...employeeReadCapabilities,
    canImportEmployees: true,
} satisfies EmployeePresentationCapabilities;

function DashboardNavigationState(): ReactElement {
    const { selectedMenu, mobileNavOpen, desktopSidebarCollapsed } =
        useDashboardUIContext();

    return (
        <>
            <output data-testid="selected-menu">{selectedMenu}</output>
            <output data-testid="mobile-nav-open">
                {String(mobileNavOpen)}
            </output>
            <output data-testid="desktop-sidebar-collapsed">
                {String(desktopSidebarCollapsed)}
            </output>
        </>
    );
}

function DashboardMenuState(): ReactElement {
    const { availableMenuGroups } = useDashboardDataContext();
    const menuIds = availableMenuGroups.flatMap((group) =>
        group.items.map((item) => item.id),
    );

    return <output data-testid="available-menu-ids">{menuIds.join(",")}</output>;
}

describe("DashboardProvider navigation state", () => {
    beforeEach(() => {
        navigationMocks.router.push.mockReset();
        navigationMocks.router.replace.mockReset();
        navigationMocks.pathname = "/dashboard";
        navigationMocks.user = {
            id: "employee-1",
            name: "สมชาย ใจดี",
            role: "EMPLOYEE",
            stockCapabilities,
        };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("starts with mobile navigation closed and desktop sidebar expanded", () => {
        render(
            <DashboardProvider>
                <DashboardNavigationState />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("mobile-nav-open")).toHaveTextContent(
            "false",
        );
        expect(
            screen.getByTestId("desktop-sidebar-collapsed"),
        ).toHaveTextContent("false");
    });

    it("derives the selected menu from the canonical pathname", () => {
        navigationMocks.pathname = "/dashboard/employees/import";

        render(
            <DashboardProvider>
                <DashboardNavigationState />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("selected-menu")).toHaveTextContent(
            "import-employee",
        );
        expect(navigationMocks.router.replace).not.toHaveBeenCalled();
    });

    it("navigates menu clicks to canonical paths", () => {
        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button
                    type="button"
                    onClick={() => handleMenuClick("stock")}
                >
                    Stock
                </button>
            );
        }

        render(
            <DashboardProvider>
                <NavigationProbe />
            </DashboardProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Stock" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/stock",
            { scroll: false },
        );
    });

    it("requires Routine read capability for visibility and stale menu clicks", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            routineCapabilities: {
                ...routineCapabilities,
                canReadTasks: false,
            },
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button type="button" onClick={() => handleMenuClick("routine")}>
                    Routine
                </button>
            );
        }

        render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).not.toHaveTextContent("routine");
        fireEvent.click(screen.getByRole("button", { name: "Routine" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith("/access-denied");
    });

    it("allows Routine navigation when its feature and read capability are available", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            routineCapabilities,
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button type="button" onClick={() => handleMenuClick("routine")}>
                    Routine
                </button>
            );
        }

        render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).toHaveTextContent("routine");
        fireEvent.click(screen.getByRole("button", { name: "Routine" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/routine",
            { scroll: false },
        );
    });

    it("hides and denies Leave navigation when no Leave surface is usable", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            leaveCapabilities: noLeaveCapabilities,
            canApproveLeave: false,
            canViewLeaveReports: false,
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button type="button" onClick={() => handleMenuClick("leave-management")}>
                    Leave
                </button>
            );
        }

        render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).not.toHaveTextContent("leave-management");
        fireEvent.click(screen.getByRole("button", { name: "Leave" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith("/access-denied");
    });

    it("allows an explicit USER approver-management grant to open Leave", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canManageApprovers: true,
            },
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button type="button" onClick={() => handleMenuClick("leave-management")}>
                    Leave
                </button>
            );
        }

        render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).toHaveTextContent("leave-management");
        fireEvent.click(screen.getByRole("button", { name: "Leave" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/leave",
            { scroll: false },
        );
    });

    it("allows a normal USER to open Employee information with read capability", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            employeeCapabilities: employeeReadCapabilities,
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button
                    type="button"
                    onClick={() => handleMenuClick("employee-management")}
                >
                    Employees
                </button>
            );
        }

        render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).toHaveTextContent(
            "employee-management",
        );
        fireEvent.click(screen.getByRole("button", { name: "Employees" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/employees",
            { scroll: false },
        );
    });

    it("denies Add Employee without create capability and allows an explicit USER grant", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            employeeCapabilities: employeeReadCapabilities,
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button
                    type="button"
                    onClick={() => handleMenuClick("add-employee")}
                >
                    Add Employee
                </button>
            );
        }

        const { rerender } = render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).not.toHaveTextContent(
            "add-employee",
        );
        fireEvent.click(screen.getByRole("button", { name: "Add Employee" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith("/access-denied");

        navigationMocks.router.push.mockReset();
        navigationMocks.user = {
            ...navigationMocks.user,
            employeeCapabilities: employeeCreateCapabilities,
        };
        rerender(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).toHaveTextContent(
            "add-employee",
        );
        fireEvent.click(screen.getByRole("button", { name: "Add Employee" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/employees/new",
            { scroll: false },
        );
    });

    it("denies Import Employee without import capability and allows an explicit USER grant", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            employeeCapabilities: employeeReadCapabilities,
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button
                    type="button"
                    onClick={() => handleMenuClick("import-employee")}
                >
                    Import Employee
                </button>
            );
        }

        const { rerender } = render(
            <DashboardProvider>
                <NavigationProbe />
            </DashboardProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Import Employee" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith("/access-denied");

        navigationMocks.router.push.mockReset();
        navigationMocks.user = {
            ...navigationMocks.user,
            employeeCapabilities: employeeImportCapabilities,
        };
        rerender(
            <DashboardProvider>
                <NavigationProbe />
            </DashboardProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Import Employee" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/employees/import",
            { scroll: false },
        );
    });

    it("keeps unrelated ADMIN-only navigation role-gated", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
            employeeCapabilities: {
                ...employeeCreateCapabilities,
                canImportEmployees: true,
            },
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button
                    type="button"
                    onClick={() => handleMenuClick("email-request")}
                >
                    Email Request
                </button>
            );
        }

        render(
            <DashboardProvider>
                <NavigationProbe />
            </DashboardProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: "Email Request" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith("/access-denied");
    });

    it("uses projected Audit access for visibility and stale menu clicks", () => {
        navigationMocks.user = {
            ...navigationMocks.user,
            role: "USER",
        };

        function NavigationProbe(): ReactElement {
            const { handleMenuClick } = useDashboardUIContext();
            return (
                <button
                    type="button"
                    onClick={() => handleMenuClick("audit-logs")}
                >
                    Audit
                </button>
            );
        }

        const { rerender } = render(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).not.toHaveTextContent("audit-logs");
        fireEvent.click(screen.getByRole("button", { name: "Audit" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith("/access-denied");

        navigationMocks.router.push.mockReset();
        navigationMocks.user = {
            ...navigationMocks.user,
            auditCapabilities: { canReadAuditLogs: true },
        };
        rerender(
            <DashboardProvider>
                <DashboardMenuState />
                <NavigationProbe />
            </DashboardProvider>,
        );

        expect(screen.getByTestId("available-menu-ids")).toHaveTextContent("audit-logs");
        fireEvent.click(screen.getByRole("button", { name: "Audit" }));
        expect(navigationMocks.router.push).toHaveBeenCalledWith(
            "/dashboard/audit",
            { scroll: false },
        );
    });
});
