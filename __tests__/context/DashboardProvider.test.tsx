import { render, screen, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardProvider } from "@/components/dashboard/context/dashboard/DashboardProvider";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

const navigationMocks = vi.hoisted(() => ({
    router: {
        push: vi.fn(),
        replace: vi.fn(),
    },
    searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => navigationMocks.router,
    useSearchParams: () => navigationMocks.searchParams,
    usePathname: () => "/dashboard",
}));

vi.mock("swr", () => ({
    default: () => ({
        data: undefined,
        mutate: vi.fn(),
    }),
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
        navigationMocks.searchParams = new URLSearchParams();
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

    it("falls back to the dashboard for a removed IT Support URL", async () => {
        navigationMocks.searchParams = new URLSearchParams("tab=it-support");

        render(
            <DashboardProvider>
                <DashboardNavigationState />
            </DashboardProvider>,
        );

        await waitFor(() => {
            expect(screen.getByTestId("selected-menu")).toHaveTextContent(
                "dashboard",
            );
            expect(navigationMocks.router.replace).toHaveBeenCalledWith(
                "/dashboard?tab=dashboard",
                { scroll: false },
            );
        });
    });
});
