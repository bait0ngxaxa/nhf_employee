import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardHomeSection } from "@/components/dashboard/sections/DashboardHomeSection";
import { getAvailableMenuGroups } from "@/constants/dashboard";
import { getCurrentGreeting } from "@/components/dashboard/sections/DashboardGreeting";
import type { MenuGroup } from "@/types/dashboard";
import { DASHBOARD_MENU_GROUPS } from "@/constants/dashboard";

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardDataContext: vi.fn(),
    useDashboardUIContext: vi.fn(),
}));

vi.mock("@/components/dashboard/line/LineAddFriendCard", () => ({
    LineAddFriendCard: () => <div data-testid="line-add-friend-card" />,
}));

describe("DashboardHomeSection identity presentation", () => {
    it("keeps the fallback greeting through server render and initial hydration", async () => {
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

        const element = <DashboardHomeSection />;
        const serverMarkup = renderToString(element);
        expect(serverMarkup).toContain("สวัสดี");

        const container = document.createElement("div");
        container.innerHTML = serverMarkup;
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const root = hydrateRoot(container, element);

        expect(container.querySelector("#dashboard-home-heading")?.textContent)
            .toContain("สวัสดี,");

        await act(async () => {
            await Promise.resolve();
        });

        const hydrationErrors = consoleError.mock.calls.filter((call) =>
            call.some((value) => /hydration|did not match/i.test(String(value))),
        );
        expect(hydrationErrors).toHaveLength(0);
        root.unmount();
        consoleError.mockRestore();
    });

    it("renders the client-ready greeting using Thai application time", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-01-01T05:00:00.000+07:00"));
        try {
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

            await waitFor(() => {
                expect(screen.getByText("อรุณสวัสดิ์,")).toBeInTheDocument();
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it.each([
        ["04:59", "2026-01-01T04:59:00.000+07:00", "ราตรีสวัสดิ์"],
        ["05:00", "2026-01-01T05:00:00.000+07:00", "อรุณสวัสดิ์"],
        ["11:59", "2026-01-01T11:59:00.000+07:00", "อรุณสวัสดิ์"],
        ["12:00", "2026-01-01T12:00:00.000+07:00", "สวัสดียามบ่าย"],
        ["16:59", "2026-01-01T16:59:00.000+07:00", "สวัสดียามบ่าย"],
        ["17:00", "2026-01-01T17:00:00.000+07:00", "สวัสดีตอนเย็น"],
        ["21:59", "2026-01-01T21:59:00.000+07:00", "สวัสดีตอนเย็น"],
        ["22:00", "2026-01-01T22:00:00.000+07:00", "ราตรีสวัสดิ์"],
    ])("classifies the Bangkok greeting at %s", (_label, timestamp, expected) => {
        expect(getCurrentGreeting(new Date(timestamp))).toBe(expected);
    });

    it("preserves a long Thai name and nickname in the greeting", () => {
        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated", user: { id: "1", name: "สมชาย วัฒนศิริกุลมหาประเสริฐ (ชาย)", role: "ADMIN", department: "IT", teams: [] },
            isAdmin: true, availableMenuGroups: [],
        });
        vi.mocked(useDashboardUIContext).mockReturnValue({
            selectedMenu: "dashboard", mobileNavOpen: false, setMobileNavOpen: vi.fn(),
            desktopSidebarCollapsed: false, setDesktopSidebarCollapsed: vi.fn(), handleMenuClick: vi.fn(), handleSignOut: vi.fn(), router: {} as never,
        });
        render(<DashboardHomeSection />);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("สมชาย วัฒนศิริกุลมหาประเสริฐ (ชาย)");
    });

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

describe("compact NHF quick actions", () => {
    function renderHome(groups: MenuGroup[]): ReturnType<typeof render> {
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: { id: "1", name: "ทดสอบ", role: "USER" }, isAdmin: false, availableMenuGroups: groups });
        vi.mocked(useDashboardUIContext).mockReturnValue({ selectedMenu: "dashboard", mobileNavOpen: false, setMobileNavOpen: vi.fn(), desktopSidebarCollapsed: false, setDesktopSidebarCollapsed: vi.fn(), handleMenuClick: vi.fn(), handleSignOut: vi.fn(), router: {} as never });
        return render(<DashboardHomeSection announcement={<p>ประกาศทดสอบ</p>} />);
    }

    it("preserves module branding and destinations while keeping desktop Featured Cards", () => {
        renderHome([DASHBOARD_MENU_GROUPS[0]]);
        const grid = screen.getByRole("region", { name: "เมนูด่วน" });
        const buttons = within(grid).getAllByRole("button");
        expect(buttons.map((button) => button.textContent)).toEqual(["เบิกวัสดุ", "วันลา", "งานประจำ", "บริการ IT"]);
        expect(buttons[0]).toHaveClass("bg-module-stock-dashboard-surface");
        expect(buttons[1]).toHaveClass("bg-module-leave-dashboard-surface");
        expect(buttons[2]).toHaveClass("bg-module-routine-dashboard-surface");
        expect(buttons[3]).toHaveClass("bg-module-it-dashboard-surface");
        for (const button of buttons) {
            expect(button).toHaveClass("h-28", "focus-visible:ring-2");
            expect(button.querySelector(".line-clamp-2")).not.toBeNull();
            expect(button).not.toHaveTextContent("Quick action");
        }
        fireEvent.click(buttons[2]);
        expect(useDashboardUIContext().handleMenuClick).toHaveBeenCalledWith("routine");
        expect(screen.getByRole("button", { name: /NHF IT-TICKET/ })).toHaveClass("min-h-[196px]");
        expect(screen.getByText("ประกาศทดสอบ")).toBeInTheDocument();
        expect(screen.getByTestId("line-add-friend-card")).toBeInTheDocument();
    });

    it("supports a single module and additional administrative services without filler", () => {
        const group = DASHBOARD_MENU_GROUPS[0];
        const view = renderHome([{ ...group, items: group.items.filter((item) => item.id === "stock") }]);
        expect(within(screen.getByRole("region", { name: "เมนูด่วน" })).getAllByRole("button")).toHaveLength(1);
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: undefined, isAdmin: true, availableMenuGroups: DASHBOARD_MENU_GROUPS });
        view.rerender(<DashboardHomeSection />);
        const grid = screen.getByRole("region", { name: "เมนูด่วน" });
        expect(within(grid).getByRole("button", { name: "จัดการสิทธิ์การใช้งาน" })).toBeInTheDocument();
        fireEvent.click(within(grid).getByRole("button", { name: "จัดการสิทธิ์การใช้งาน" }));
        expect(useDashboardUIContext().handleMenuClick).toHaveBeenCalledWith("authorization-administration");
    });

    it("shows an empty state and follows actual feature/capability filtering", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        try {
            renderHome(getAvailableMenuGroups(false));
            const grid = screen.getByRole("region", { name: "เมนูด่วน" });
            expect(within(grid).queryByRole("button")).not.toBeInTheDocument();
            expect(within(grid).getByText("ยังไม่มีเมนูที่พร้อมใช้งานสำหรับบัญชีนี้")).toBeInTheDocument();
        } finally { vi.unstubAllEnvs(); }
    });

    it("keeps unavailable Leave discoverable and clamps long Thai labels", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        try {
            const groups = getAvailableMenuGroups(false);
            const longLabel = "รายการบริการสำหรับพนักงานและผู้ดูแลระบบที่มีข้อความภาษาไทยยาว";
            groups[0].items.push({ ...DASHBOARD_MENU_GROUPS[1].items[0], sidebarLabel: longLabel });
            renderHome(groups);
            const grid = screen.getByRole("region", { name: "เมนูด่วน" });
            expect(within(grid).getByRole("button", { name: "วันลา (ยังไม่พร้อมให้บริการ)" })).not.toBeDisabled();
            expect(within(grid).getByText(longLabel)).toHaveClass("line-clamp-2", "[overflow-wrap:anywhere]");
        } finally { vi.unstubAllEnvs(); }
    });
});


it("marks disabled Leave as unavailable on the dashboard home", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
    try {
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: { id: "1", name: "ทดสอบ", role: "USER" }, isAdmin: false, availableMenuGroups: getAvailableMenuGroups(false) });
        vi.mocked(useDashboardUIContext).mockReturnValue({ selectedMenu: "dashboard", mobileNavOpen: false, setMobileNavOpen: vi.fn(), desktopSidebarCollapsed: false, setDesktopSidebarCollapsed: vi.fn(), handleMenuClick: vi.fn(), handleSignOut: vi.fn(), router: {} as never });
        render(<DashboardHomeSection />);
        expect(screen.getByRole("button", { name: /NHF Leave/ })).toHaveTextContent("ยังไม่พร้อมให้บริการ");
    } finally {
        vi.unstubAllEnvs();
    }
});
