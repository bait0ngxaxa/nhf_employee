import { act, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
    useDashboardDataContext,
    useDashboardUIContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardHomeSection } from "@/components/dashboard/sections/DashboardHomeSection";
import { getCurrentGreeting } from "@/components/dashboard/sections/DashboardGreeting";

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
