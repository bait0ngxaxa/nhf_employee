import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "@/components/dashboard/layout/DashboardSidebar";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { getAvailableMenuGroups } from "@/constants/dashboard";
import { useExpandedSidebarGroups } from "@/components/dashboard/layout/DashboardSidebarPrimitives";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
    useDashboardUIContext: vi.fn(),
}));

const handleMenuClick = vi.fn();
const setDesktopSidebarCollapsed = vi.fn();
const adminEmployeeCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: true,
    canUpdateEmployees: true,
    canDeleteEmployees: true,
    canImportEmployees: true,
    canExportEmployees: true,
} as const;

function mockSidebarContext(desktopSidebarCollapsed: boolean): void {
    vi.mocked(useDashboardDataContext).mockReturnValue({
        status: "authenticated",
        user: {
            name: "สมชาย ใจดี",
            role: "ADMIN",
            department: "IT",
            teams: [{ id: 1, name: "IT" }],
            employeeCapabilities: adminEmployeeCapabilities,
        },
        isAdmin: true,
        availableMenuGroups: getAvailableMenuGroups(
            true,
            undefined,
            undefined,
            undefined,
            adminEmployeeCapabilities,
        ),
    });
    vi.mocked(useDashboardUIContext).mockReturnValue({
        selectedMenu: "employee-management",
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

    it("keeps explicit group collapse separate from menu availability", () => {
        const groupA = {
            id: "group-a",
            label: "กลุ่ม A",
            icon: () => null,
            items: [],
        };
        const groupB = {
            id: "group-b",
            label: "กลุ่ม B",
            icon: () => null,
            items: [],
        };
        const { result, rerender } = renderHook(
            ({ groups }: { groups: typeof groupA[] }) =>
                useExpandedSidebarGroups(groups),
            { initialProps: { groups: [groupA] } },
        );

        expect(result.current.expandedGroups.has(groupA.id)).toBe(true);

        act(() => result.current.toggleGroup(groupA.id));
        expect(result.current.expandedGroups.has(groupA.id)).toBe(false);

        rerender({ groups: [{ ...groupA }] });
        expect(result.current.expandedGroups.has(groupA.id)).toBe(false);

        rerender({ groups: [groupA, groupB] });
        expect(result.current.expandedGroups.has(groupA.id)).toBe(false);
        expect(result.current.expandedGroups.has(groupB.id)).toBe(true);

        rerender({ groups: [groupB] });
        expect(result.current.expandedGroups.has(groupA.id)).toBe(false);

        rerender({ groups: [groupA, groupB] });
        expect(result.current.expandedGroups.has(groupA.id)).toBe(false);

        act(() => result.current.toggleGroup(groupA.id));
        expect(result.current.expandedGroups.has(groupA.id)).toBe(true);
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

    it("shows Team context without exposing the internal system role", () => {
        mockSidebarContext(false);

        render(<DashboardSidebar />);

        expect(screen.getByText("ทีม IT")).toBeInTheDocument();
        expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
        expect(screen.queryByText("บทบาทระบบ")).not.toBeInTheDocument();
    });

    it("uses the neutral no-Team fallback", () => {
        mockSidebarContext(false);
        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: {
                name: "สมชาย ใจดี",
                role: "USER",
                teams: [],
            },
            isAdmin: false,
            availableMenuGroups: [],
        });

        render(<DashboardSidebar />);

        expect(screen.getByText("ยังไม่กำหนดทีม")).toBeInTheDocument();
        expect(screen.queryByText("USER")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ใช้งาน")).not.toBeInTheDocument();
    });
});
