import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardProvider } from "@/components/dashboard/context/dashboard/DashboardProvider";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

const navigationMocks = vi.hoisted(() => ({
    pathname: "/dashboard",
    router: {
        push: vi.fn(),
        replace: vi.fn(),
    },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => navigationMocks.router,
    usePathname: () => navigationMocks.pathname,
}));

vi.mock("@/modules/stock/client", () => ({
    clearStockBrowseCart: vi.fn(),
}));

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: () => ({
        user: {
            id: "employee-1",
            name: "สมชาย ใจดี",
            role: "EMPLOYEE",
        },
        status: "authenticated",
        signOut: vi.fn(),
    }),
}));

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

describe("DashboardProvider navigation state", () => {
    beforeEach(() => {
        navigationMocks.router.push.mockReset();
        navigationMocks.router.replace.mockReset();
        navigationMocks.pathname = "/dashboard";
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
});
