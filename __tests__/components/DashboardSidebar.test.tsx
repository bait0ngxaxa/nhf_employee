import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "@/components/dashboard/layout/DashboardSidebar";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { getAvailableMenuGroups } from "@/constants/dashboard";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
    useDashboardUIContext: vi.fn(),
}));

const handleMenuClick = vi.fn();
const setDesktopSidebarCollapsed = vi.fn();

function mockSidebarContext(desktopSidebarCollapsed: boolean): void {
    vi.mocked(useDashboardDataContext).mockReturnValue({
        status: "authenticated",
        user: { name: "สมชาย ใจดี", role: "ADMIN", department: "IT" },
        isAdmin: true,
        employeeStats: { total: 0, active: 0, admin: 0, academic: 0 },
        refreshTrigger: 0,
        handleEmployeeAdded: vi.fn(),
        availableMenuGroups: getAvailableMenuGroups(true),
    });
    vi.mocked(useDashboardUIContext).mockReturnValue({
        selectedMenu: "employee-management",
        setSelectedMenu: vi.fn(),
        mobileNavOpen: false,
        setMobileNavOpen: vi.fn(),
        desktopSidebarCollapsed,
        setDesktopSidebarCollapsed,
        handleMenuClick,
        handleSignOut: vi.fn(),
        router: {} as never,
    });
}

describe("DashboardSidebar", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("marks the current menu and exposes expandable menu groups", () => {
        mockSidebarContext(false);

        render(<DashboardSidebar />);

        expect(
            screen.getByRole("navigation", { name: "เมนูหลัก" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "ข้อมูลพนักงาน" }),
        ).toHaveAttribute("aria-current", "page");

        const managementGroup = screen.getByRole("button", {
            name: "การจัดการระบบ",
        });
        expect(managementGroup).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(managementGroup);

        expect(managementGroup).toHaveAttribute("aria-expanded", "false");
        expect(
            screen.queryByRole("button", { name: "ข้อมูลพนักงาน" }),
        ).not.toBeInTheDocument();
    });

    it("keeps icon-only menu items named when the sidebar is collapsed", () => {
        mockSidebarContext(true);

        render(<DashboardSidebar />);

        const employeeMenu = screen.getByRole("button", {
            name: "ข้อมูลพนักงาน",
        });
        expect(employeeMenu).toHaveAttribute("title", "ข้อมูลพนักงาน");
        expect(employeeMenu).toHaveAttribute("aria-current", "page");

        fireEvent.click(employeeMenu);

        expect(handleMenuClick).toHaveBeenCalledWith("employee-management");
    });

    it("toggles the sidebar width state from the header control", () => {
        mockSidebarContext(false);

        render(<DashboardSidebar />);

        fireEvent.click(screen.getByRole("button", { name: "ย่อเมนู" }));

        expect(setDesktopSidebarCollapsed).toHaveBeenCalledWith(true);
    });

    it("keeps mobile navigation expanded without a desktop collapse control", () => {
        mockSidebarContext(true);

        render(<DashboardSidebar variant="mobile" />);

        expect(
            screen.getByRole("button", { name: "ข้อมูลพนักงาน" }),
        ).not.toHaveAttribute("title");
        expect(
            screen.queryByRole("button", { name: "ย่อเมนู" }),
        ).not.toBeInTheDocument();
    });
});
