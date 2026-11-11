import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardNavbar } from "@/components/dashboard/layout/DashboardNavbar";
import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

const notificationDropdownMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
    useDashboardUIContext: vi.fn(),
}));

vi.mock(
    "@/modules/notification/client",
    () => ({
        NotificationDropdown: (props: { canUpdateInbox: boolean }) => {
            notificationDropdownMock(props);
            return <button type="button">การแจ้งเตือน</button>;
        },
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
            teams: [{ id: 1, name: "IT" }],
        },
        isAdmin: false,
        availableMenuGroups: [],
    });
    vi.mocked(useDashboardUIContext).mockReturnValue({
        selectedMenu: "dashboard",
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

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows compact application identity without a drawer trigger", () => {
        mockNavbarContext(false);
        render(<DashboardNavbar />);
        expect(screen.getByText("NHFapp")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "เปิดเมนูหลัก" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog", { name: "เมนูหลัก" })).not.toBeInTheDocument();
        expect(screen.queryByTestId("dashboard-sidebar")).not.toBeInTheDocument();
    });

    it("does not mount the Notification dropdown without read capability", () => {
        mockNavbarContext(false);

        render(<DashboardNavbar />);

        expect(screen.queryByRole("button", { name: "การแจ้งเตือน" })).not.toBeInTheDocument();
        expect(notificationDropdownMock).not.toHaveBeenCalled();
    });

    it("shows Team context without exposing the internal system role", () => {
        mockNavbarContext(false);
        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: {
                id: "employee-1",
                name: "สมชาย ใจดี",
                email: "somchai@example.com",
                role: "ADMIN",
                teams: [{ id: 1, name: "IT" }],
            },
            isAdmin: true,
            availableMenuGroups: [],
        });

        render(<DashboardNavbar />);

        expect(screen.getAllByText("ทีม IT").length).toBeGreaterThan(0);
        expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
        expect(screen.queryByText("บทบาทระบบ")).not.toBeInTheDocument();
    });

    it("uses the neutral no-Team fallback", () => {
        mockNavbarContext(false);
        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: {
                id: "employee-1",
                name: "สมชาย ใจดี",
                email: "somchai@example.com",
                role: "USER",
                teams: [],
            },
            isAdmin: false,
            availableMenuGroups: [],
        });
        render(<DashboardNavbar />);

        expect(screen.getAllByText("ยังไม่กำหนดทีม").length).toBeGreaterThan(0);
        expect(screen.queryByText("USER")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ใช้งาน")).not.toBeInTheDocument();
    });

    it("passes independent read-only Notification update state to the dropdown", () => {
        mockNavbarContext(false);
        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: {
                id: "employee-1",
                name: "สมชาย ใจดี",
                email: "somchai@example.com",
                role: "USER",
                notificationCapabilities: {
                    canReadInbox: true,
                    canUpdateInbox: false,
                },
            },
            isAdmin: false,
            availableMenuGroups: [],
        });

        render(<DashboardNavbar />);

        expect(screen.getByRole("button", { name: "การแจ้งเตือน" })).toBeInTheDocument();
        expect(notificationDropdownMock).toHaveBeenCalledWith({
            canUpdateInbox: false,
        });
    });
});
