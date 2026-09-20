import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardHomeSection } from "@/components/dashboard/sections/DashboardHomeSection";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
    useDashboardUIContext: vi.fn(),
}));

vi.mock("@/components/dashboard/line/LineAddFriendCard", () => ({
    LineAddFriendCard: () => <div data-testid="line-add-friend-card" />,
}));

describe("DashboardHomeSection identity presentation", () => {
    it("uses Team context instead of exposing the internal system role", () => {
        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: {
                id: "1",
                name: "สมชาย ใจดี",
                role: "ADMIN",
                department: "IT",
                teams: [{ id: 1, name: "IT" }],
            },
            isAdmin: true,
            availableMenuGroups: [],
        });
        vi.mocked(useDashboardUIContext).mockReturnValue({
            selectedMenu: "dashboard",
            mobileNavOpen: false,
            setMobileNavOpen: vi.fn(),
            desktopSidebarCollapsed: false,
            setDesktopSidebarCollapsed: vi.fn(),
            handleMenuClick: vi.fn(),
            handleSignOut: vi.fn(),
            router: {} as never,
        });

        render(<DashboardHomeSection />);

        expect(screen.getByText("ทีม IT")).toBeInTheDocument();
        expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
    });
});
