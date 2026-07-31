import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardLayoutClient } from "@/components/dashboard/layout/DashboardLayoutClient";

const dashboardContext = vi.hoisted(() => ({
    status: "authenticated",
    selectedMenu: "dashboard",
}));

vi.mock("@/components/dashboard/context", () => ({
    useDashboardContext: () => dashboardContext,
}));

vi.mock("@/components/dashboard/layout/DashboardNavbar", () => ({
    DashboardNavbar: () => <nav aria-label="แถบนำทางด้านบน" />,
}));

vi.mock("@/components/dashboard/layout/DashboardSidebar", () => ({
    DashboardSidebar: () => <nav aria-label="เมนูหลัก" />,
}));

describe("DashboardLayoutClient page navigation", () => {
    const scrollTo = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        dashboardContext.status = "authenticated";
        dashboardContext.selectedMenu = "dashboard";
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
            configurable: true,
            value: scrollTo,
        });
    });

    it("resets the main scroll position and focuses the new page heading", async () => {
        const { rerender } = render(
            <DashboardLayoutClient>
                <h1 data-page-heading tabIndex={-1}>
                    หน้าหลัก
                </h1>
            </DashboardLayoutClient>,
        );

        expect(scrollTo).not.toHaveBeenCalled();

        dashboardContext.selectedMenu = "stock";
        rerender(
            <DashboardLayoutClient>
                <h1 data-page-heading tabIndex={-1}>
                    NHF Stock
                </h1>
            </DashboardLayoutClient>,
        );

        await waitFor(() => {
            expect(scrollTo).toHaveBeenCalledWith({
                top: 0,
                left: 0,
                behavior: "auto",
            });
            expect(
                screen.getByRole("heading", {
                    level: 1,
                    name: "NHF Stock",
                }),
            ).toHaveFocus();
        });
        expect(screen.getByRole("status")).toHaveTextContent(
            "เปิดหน้า NHF Stock แล้ว",
        );
    });

    it("waits for a dynamically loaded page heading before moving focus", async () => {
        const { rerender } = render(
            <DashboardLayoutClient>
                <h1 data-page-heading tabIndex={-1}>
                    หน้าหลัก
                </h1>
            </DashboardLayoutClient>,
        );

        dashboardContext.selectedMenu = "it-support";
        rerender(
            <DashboardLayoutClient>
                <div>กำลังโหลด</div>
            </DashboardLayoutClient>,
        );

        expect(scrollTo).toHaveBeenCalledTimes(1);

        rerender(
            <DashboardLayoutClient>
                <h1 data-page-heading tabIndex={-1}>
                    NHF IT-Support
                </h1>
            </DashboardLayoutClient>,
        );

        await waitFor(() => {
            expect(
                screen.getByRole("heading", {
                    level: 1,
                    name: "NHF IT-Support",
                }),
            ).toHaveFocus();
        });
    });
});
