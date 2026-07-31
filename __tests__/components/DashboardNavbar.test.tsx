import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardNavbar } from "@/components/dashboard/layout/DashboardNavbar";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
    useDashboardUIContext: vi.fn(),
}));

vi.mock(
    "@/components/dashboard/notifications/NotificationDropdown",
    () => ({
        NotificationDropdown: () => <button type="button">การแจ้งเตือน</button>,
    }),
);

vi.mock("@/components/dashboard/layout/DashboardSidebar", () => ({
    DashboardSidebar: ({ variant }: { variant?: string }) => (
        <nav data-testid="dashboard-sidebar" data-variant={variant} />
    ),
}));

const setMobileNavOpen = vi.fn();

function mockNavbarContext(mobileNavOpen: boolean): void {
    vi.mocked(useDashboardDataContext).mockReturnValue({
        status: "authenticated",
        user: {
            id: "employee-1",
            name: "สมชาย ใจดี",
            email: "somchai@example.com",
            role: "EMPLOYEE",
            department: "IT",
        },
        isAdmin: false,
        employeeStats: { total: 0, active: 0, admin: 0, academic: 0 },
        refreshTrigger: 0,
        handleEmployeeAdded: vi.fn(),
        availableMenuGroups: [],
    });
    vi.mocked(useDashboardUIContext).mockReturnValue({
        selectedMenu: "dashboard",
        setSelectedMenu: vi.fn(),
        mobileNavOpen,
        setMobileNavOpen,
        desktopSidebarCollapsed: false,
        setDesktopSidebarCollapsed: vi.fn(),
        handleMenuClick: vi.fn(),
        handleSignOut: vi.fn(),
        router: {} as never,
    });
}

describe("DashboardNavbar mobile navigation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("keeps the mobile navigation closed until its trigger is activated", () => {
        mockNavbarContext(false);

        render(<DashboardNavbar />);

        const trigger = screen.getByRole("button", {
            name: "เปิดเมนูหลัก",
        });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(
            screen.queryByRole("dialog", { name: "เมนูหลัก" }),
        ).not.toBeInTheDocument();

        fireEvent.click(trigger);

        expect(setMobileNavOpen).toHaveBeenCalledWith(true);
    });

    it("renders mobile navigation in an accessible Sheet with a close control", () => {
        mockNavbarContext(true);

        render(<DashboardNavbar />);

        expect(
            screen.getByRole("dialog", { name: "เมนูหลัก" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("dashboard-sidebar")).toHaveAttribute(
            "data-variant",
            "mobile",
        );

        fireEvent.click(
            screen.getByRole("button", { name: "ปิดเมนู" }),
        );

        expect(setMobileNavOpen).toHaveBeenCalledWith(false);
    });
});
