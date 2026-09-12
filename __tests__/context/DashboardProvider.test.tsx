import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardProvider } from "@/components/dashboard/context/dashboard/DashboardProvider";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import type { AuthenticatedUser } from "@/modules/auth/client";

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
});
