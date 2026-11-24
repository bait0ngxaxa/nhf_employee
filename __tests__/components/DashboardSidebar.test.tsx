import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "@/components/dashboard/layout/DashboardSidebar";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import {
    DASHBOARD_MENU_GROUPS,
    getAvailableMenuGroups,
} from "@/constants/dashboard";
import { VISUAL_ASSETS } from "@/lib/ui/visual-assets";
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

function mockSidebarContext(
    desktopSidebarCollapsed: boolean,
    availableMenuGroups = getAvailableMenuGroups(
        true,
        undefined,
        undefined,
        undefined,
        adminEmployeeCapabilities,
    ),
): void {
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
        availableMenuGroups,
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

        const peopleGroup = screen.getByRole("button", {
            name: "บุคลากร",
        });
        expect(peopleGroup).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(peopleGroup);

        expect(peopleGroup).toHaveAttribute("aria-expanded", "false");
        expect(
            screen.queryByRole("button", { name: "ข้อมูลพนักงาน" }),
        ).not.toBeInTheDocument();
    });

    it("shows task-oriented Thai labels in the expanded sidebar", () => {
        mockSidebarContext(false, DASHBOARD_MENU_GROUPS);

        render(<DashboardSidebar />);

        expect(
            screen.getByRole("button", { name: "การลา" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "วัสดุและคลัง" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "งานประจำ" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: "คำร้องพนักงานใหม่",
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "NHF Leave" }),
        ).not.toBeInTheDocument();
    });

    it.each([false, true])("renders compact artwork in the projected sidebar (collapsed=%s)", (collapsed) => {
        mockSidebarContext(collapsed, DASHBOARD_MENU_GROUPS);
        render(<DashboardSidebar />);

        for (const item of DASHBOARD_MENU_GROUPS.flatMap((group) => group.items)) {
            const button = screen.getByRole("button", { name: item.sidebarLabel ?? item.label });
            if (!item.asset) {
                expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
                continue;
            }
            const artwork = button.querySelector("img");
            expect(artwork?.src).toBe(new URL(VISUAL_ASSETS[item.asset].compactSrc, document.baseURI).href);
            expect(artwork).toHaveAttribute("alt", "");
            expect(artwork).toHaveAttribute("width", "24");
        }
        const home = screen.getByRole("button", { name: "หน้าหลัก" });
        expect(home.querySelector("img")).toBeNull();
        expect(home.querySelector(".lucide-house")).toHaveAttribute("aria-hidden", "true");
        expect(screen.queryByRole("button", { name: "นำเข้าจาก CSV" })).not.toBeInTheDocument();
    });

    it("keeps a collapsed destination named and actionable after artwork fails", () => {
        mockSidebarContext(true);
        render(<DashboardSidebar />);
        const destination = screen.getByRole("button", { name: "ข้อมูลพนักงาน" });
        const image = destination.querySelector("img");
        if (!image) throw new Error("Missing employee artwork");
        const artworkSlot = image.parentElement;
        fireEvent.error(image);
        expect(artworkSlot).toHaveClass("size-6");
        expect(artworkSlot?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        expect(destination).toHaveAccessibleName("ข้อมูลพนักงาน");
        fireEvent.click(destination);
        expect(handleMenuClick).toHaveBeenCalledWith("employee-management");
    });

    it("keeps coming-soon artwork disabled and omits destinations outside the filtered groups", () => {
        const group = DASHBOARD_MENU_GROUPS[0];
        mockSidebarContext(true, [{ ...group, items: group.items.filter((item) => item.id === "stock").map((item) => ({ ...item, comingSoon: true })) }]);
        render(<DashboardSidebar />);
        const comingSoon = screen.getByRole("button", { name: "วัสดุและคลัง (เร็วๆ นี้)" });
        expect(comingSoon).toBeDisabled();
        expect(comingSoon.querySelector("img")?.parentElement).toHaveClass("grayscale");
        fireEvent.click(comingSoon);
        expect(handleMenuClick).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "ข้อมูลพนักงาน" })).not.toBeInTheDocument();
    });

    it("shows the unavailable state and retains navigation in the sidebar", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        try {
            mockSidebarContext(false, getAvailableMenuGroups(false));
            render(<DashboardSidebar />);
            const item = screen.getByRole("button", { name: /การลา.*ยังไม่พร้อมให้บริการ/ });
            expect(item).toBeEnabled();
            expect(item.querySelector("img")?.parentElement).toHaveClass("grayscale");
            fireEvent.click(item);
            expect(handleMenuClick).toHaveBeenCalledWith("leave-management");
        } finally {
            vi.unstubAllEnvs();
        }
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

    it("shows the employee name without the Team or system role", () => {
        mockSidebarContext(false);

        render(<DashboardSidebar />);

        expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
        expect(screen.queryByText("ทีม IT")).not.toBeInTheDocument();
        expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
        expect(screen.queryByText("บทบาทระบบ")).not.toBeInTheDocument();
    });

    it("shows the name without a Team placeholder", () => {
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

        expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
        expect(screen.queryByText("ยังไม่กำหนดทีม")).not.toBeInTheDocument();
        expect(screen.queryByText("USER")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ใช้งาน")).not.toBeInTheDocument();
    });
});
