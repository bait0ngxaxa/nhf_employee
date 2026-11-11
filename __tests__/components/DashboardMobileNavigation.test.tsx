import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardDataContext, useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardBottomNav } from "@/components/dashboard/layout/DashboardBottomNav";
import { DashboardMoreSection } from "@/components/dashboard/sections/DashboardMoreSection";
import { DashboardNavigationLink } from "@/components/dashboard/layout/DashboardNavigationLink";
import { DASHBOARD_MENU_GROUPS } from "@/constants/dashboard";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";

function employeeCapabilities(
    overrides: Partial<EmployeePresentationCapabilities> = {},
): EmployeePresentationCapabilities {
    return {
        canReadEmployees: false,
        canReadStats: false,
        canCreateEmployees: false,
        canUpdateEmployees: false,
        canDeleteEmployees: false,
        canImportEmployees: false,
        canExportEmployees: false,
        ...overrides,
    };
}

const state = vi.hoisted(() => ({ pathname: "/dashboard", pending: false, navigated: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
    useLinkStatus: () => ({ pending: state.pending }),
    default: ({ href, children, onNavigate, prefetch: _prefetch, scroll: _scroll, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string; children?: ReactNode; prefetch?: boolean; scroll?: boolean; onNavigate?: (event: { preventDefault: () => void }) => void }) => (
        <a {...props} href={href} onClick={(event) => {
            event.preventDefault();
            let blocked = false;
            onNavigate?.({ preventDefault: () => { blocked = true; } });
            if (!blocked) state.navigated(href);
        }}>{children}</a>
    ),
}));
vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({ useDashboardDataContext: vi.fn(), useDashboardUIContext: vi.fn() }));

beforeEach(() => {
    vi.clearAllMocks();
    state.pathname = "/dashboard";
    state.pending = false;
    vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: { id: "1", name: "พนักงานทดสอบ", role: "USER" }, isAdmin: false, availableMenuGroups: [DASHBOARD_MENU_GROUPS[0]] });
    vi.mocked(useDashboardUIContext).mockReturnValue({ selectedMenu: "dashboard", mobileNavOpen: false, setMobileNavOpen: vi.fn(), desktopSidebarCollapsed: false, setDesktopSidebarCollapsed: vi.fn(), handleMenuClick: vi.fn(), handleSignOut: vi.fn(), router: {} as never });
});

describe("browser mobile navigation", () => {
    it.each([true, false])("offers Import in More only with import capability (%s)", (canImportEmployees) => {
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: { id: "1", role: "USER", employeeCapabilities: employeeCapabilities({ canImportEmployees }) }, isAdmin: false, availableMenuGroups: [] });
        render(<DashboardMoreSection />);
        expect(document.querySelector('a[href="/dashboard/employees/import"]') !== null).toBe(canImportEmployees);
        expect(document.querySelector('a[href="/dashboard/employees"]')).toBeNull();
        expect(document.querySelector('a[href="/dashboard/employees/new"]')).toBeNull();
    });

    it("uses real browser destinations and follows route history and nested module paths", () => {
        const view = render(<DashboardBottomNav />);
        const nav = screen.getByRole("navigation");
        expect(nav).toHaveClass("lg:hidden");
        expect(within(nav).getAllByRole("link")).toHaveLength(5);
        expect(screen.getByRole("link", { name: "หน้าแรก" })).toHaveAttribute("aria-current", "page");
        for (const pathname of ["/dashboard/routine", "/dashboard/stock", "/dashboard/leave", "/dashboard/routine"]) {
            state.pathname = pathname;
            view.rerender(<DashboardBottomNav />);
            const current = nav.querySelector('[aria-current="page"]');
            expect(current?.getAttribute("href")).toBe(pathname);
        }
        state.pathname = "/dashboard/stock-other";
        view.rerender(<DashboardBottomNav />);
        expect(nav.querySelector('[aria-current="page"]')).toBeNull();
    });

    it("updates More ownership for deep links, history and capability changes", () => {
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: { id: "1", role: "USER", employeeCapabilities: employeeCapabilities({ canCreateEmployees: true }), notificationCapabilities: { canReadInbox: true, canUpdateInbox: false } }, isAdmin: false, availableMenuGroups: DASHBOARD_MENU_GROUPS });
        const view = render(<DashboardBottomNav />);
        for (const path of ["/dashboard/it", "/dashboard/employees/new", "/dashboard/audit", "/dashboard/authorization", "/dashboard/sessions", "/dashboard/notifications", "/dashboard/it"]) {
            state.pathname = path;
            view.rerender(<DashboardBottomNav />);
            expect(screen.getByRole("link", { name: "เพิ่มเติม" })).toHaveAttribute("aria-current", "page");
        }
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: undefined, isAdmin: false, availableMenuGroups: [] });
        view.rerender(<DashboardBottomNav />);
        expect(screen.getByRole("navigation").querySelector('[aria-current="page"]')).toBeNull();
    });

    it("tracks Employee Import ownership across back/forward path changes and permission updates", () => {
        const importOnlyGroups = DASHBOARD_MENU_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.id !== "employee-management" && item.id !== "add-employee"),
        })).filter((group) => group.items.length > 0);
        const employeeListGroups = DASHBOARD_MENU_GROUPS.map((group) => ({
            ...group,
            items: group.items.filter((item) => item.id === "employee-management"),
        })).filter((group) => group.items.length > 0);
        const view = render(<DashboardBottomNav />);

        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: { id: "1", role: "USER", employeeCapabilities: employeeCapabilities({ canImportEmployees: true }) },
            isAdmin: false,
            availableMenuGroups: importOnlyGroups,
        });
        state.pathname = "/dashboard/employees/import";
        view.rerender(<DashboardBottomNav />);
        expect(screen.getByRole("link", { name: "เพิ่มเติม" })).toHaveAttribute("aria-current", "page");

        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: { id: "1", role: "USER", employeeCapabilities: employeeCapabilities({ canReadEmployees: true }) },
            isAdmin: false,
            availableMenuGroups: employeeListGroups,
        });
        state.pathname = "/dashboard/employees";
        view.rerender(<DashboardBottomNav />);
        expect(screen.getByRole("link", { name: "ข้อมูลพนักงาน" })).toHaveAttribute("aria-current", "page");

        state.pathname = "/dashboard/employees/import";
        view.rerender(<DashboardBottomNav />);
        expect(screen.getByRole("navigation").querySelector('[aria-current="page"]')).toBeNull();

        vi.mocked(useDashboardDataContext).mockReturnValue({
            status: "authenticated",
            user: { id: "1", role: "USER", employeeCapabilities: employeeCapabilities({ canImportEmployees: true }) },
            isAdmin: false,
            availableMenuGroups: importOnlyGroups,
        });
        view.rerender(<DashboardBottomNav />);
        expect(screen.getByRole("link", { name: "เพิ่มเติม" })).toHaveAttribute("aria-current", "page");

        state.pathname = "/dashboard/employees/import/unknown";
        view.rerender(<DashboardBottomNav />);
        expect(screen.getByRole("navigation").querySelector('[aria-current="page"]')).toBeNull();
    });

    it("updates visible tabs as capability-filtered groups change", () => {
        const view = render(<DashboardBottomNav />);
        vi.mocked(useDashboardDataContext).mockReturnValue({ status: "authenticated", user: undefined, isAdmin: false, availableMenuGroups: [] });
        view.rerender(<DashboardBottomNav />);
        expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/dashboard", "/dashboard/more"]);
    });

    it("More lists only supplied authorized groups, including IT overflow and unavailable entries", () => {
        render(<DashboardMoreSection />);
        const nav = screen.getByRole("navigation", { name: "เมนูเพิ่มเติม" });
        expect(within(nav).getByRole("link", { name: "บริการ IT" })).toHaveAttribute("href", "/dashboard/it");
        expect(within(nav).queryByRole("link", { name: "จัดการสิทธิ์การใช้งาน" })).not.toBeInTheDocument();
        expect(within(nav).getAllByRole("link").some((link) => link.getAttribute("href")?.startsWith("/liff"))).toBe(false);
        expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("data-page-heading");
        expect(screen.getByRole("link", { name: "จัดการเซสชัน" })).toHaveAttribute("href", "/dashboard/sessions");
        expect(screen.getAllByRole("button", { name: /พนักงานทดสอบ|เมนูผู้ใช้/ }).length).toBeGreaterThan(0);
    });

    it("retains inline form state when navigation is cancelled, including after a failed save", () => {
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
        const view = render(<><form data-navigation-dirty="true"><textarea defaultValue="ข้อความที่ยังไม่ส่ง" /></form><DashboardNavigationLink href="/dashboard/more">เพิ่มเติม</DashboardNavigationLink></>);
        fireEvent.click(screen.getByRole("link"));
        expect(confirm).toHaveBeenCalledOnce();
        expect(state.navigated).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toHaveValue("ข้อความที่ยังไม่ส่ง");
        confirm.mockReturnValue(true);
        fireEvent.click(screen.getByRole("link"));
        expect(state.navigated).toHaveBeenCalledWith("/dashboard/more");
        view.unmount();
        confirm.mockRestore();
    });

    it.each(["submitting", "unresolved"])("blocks links when %s even if discard is confirmed", (stateName) => {
        const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
        const attrs = { [`data-navigation-${stateName}`]: "true" };
        render(<><form {...attrs} data-navigation-dirty="true" /><DashboardNavigationLink href="/dashboard/more">เพิ่มเติม</DashboardNavigationLink></>);
        fireEvent.click(screen.getByRole("link"));
        expect(state.navigated).not.toHaveBeenCalled();
        expect(confirm).not.toHaveBeenCalled();
        expect(alert).toHaveBeenCalledOnce();
        alert.mockRestore(); confirm.mockRestore();
    });

    it("announces pending navigation", () => {
        state.pending = true;
        render(<DashboardNavigationLink href="/dashboard/more">เพิ่มเติม</DashboardNavigationLink>);
        expect(screen.getByRole("status")).toHaveTextContent("กำลังเปิดหน้า");
    });

    it("keeps the session mounted when logout is attempted during a mutation", async () => {
        const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
        render(<><form data-navigation-submitting="true" /><DashboardMoreSection /></>);
        fireEvent.pointerDown(screen.getByRole("button", { name: "เมนูผู้ใช้" }), { button: 0, ctrlKey: false });
        fireEvent.click(await screen.findByRole("menuitem", { name: "ออกจากระบบ" }));
        const dialog = await screen.findByRole("dialog", { name: "ออกจากระบบบัญชีนี้?" });
        fireEvent.click(within(dialog).getByRole("button", { name: "ออกจากระบบ" }));
        expect(useDashboardUIContext().handleSignOut).not.toHaveBeenCalled();
        expect(within(dialog).getByRole("button", { name: "ออกจากระบบ" })).toBeEnabled();
        expect(alert).toHaveBeenCalledOnce();
        alert.mockRestore();
    });

    it("reuses the existing account logout confirmation from More", async () => {
        render(<DashboardMoreSection />);
        fireEvent.pointerDown(screen.getByRole("button", { name: "เมนูผู้ใช้" }), { button: 0, ctrlKey: false });
        fireEvent.click(await screen.findByRole("menuitem", { name: "ออกจากระบบ" }));
        const dialog = await screen.findByRole("dialog", { name: "ออกจากระบบบัญชีนี้?" });
        expect(useDashboardUIContext().handleSignOut).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "ออกจากระบบ" }));
        expect(useDashboardUIContext().handleSignOut).toHaveBeenCalledOnce();
    });
});
