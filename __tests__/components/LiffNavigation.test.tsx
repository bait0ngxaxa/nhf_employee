import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    usePathname: usePathnameMock,
}));

import { LiffAppShell } from "@/components/liff/LiffAppShell";
import { APP_ROUTES } from "@/lib/ssot/routes";

describe("LIFF application shell navigation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePathnameMock.mockReturnValue(APP_ROUTES.line.routine);
    });

    it("renders accessible navigation links and marks the current module", () => {
        render(
            <LiffAppShell>
                <main id="main">Routine content</main>
            </LiffAppShell>,
        );

        expect(screen.getByRole("navigation")).toHaveAccessibleName(
            "เมนูบริการ NHFapp ผ่าน LINE",
        );
        expect(screen.getByRole("link", { name: "ไปหน้าหลัก NHFapp" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.root,
        );
        expect(screen.getByAltText("โลโก้ NHFapp")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "หน้าหลัก" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.root,
        );
        expect(screen.getByRole("link", { name: "วัสดุ" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.stock,
        );
        expect(screen.getByRole("link", { name: "วันลา" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.leave,
        );
        expect(screen.getByRole("link", { name: "งานประจำ" })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByRole("link", { name: "IT" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.it,
        );
        expect(screen.getAllByRole("link")).toHaveLength(6);
        expect(screen.getAllByText("งานประจำ")).toHaveLength(2);
    });

    it.each([
        APP_ROUTES.line.it,
        APP_ROUTES.line.itTicket(42),
        `${APP_ROUTES.line.it}/future/child`,
    ])("keeps requester IT active at %s", (pathname) => {
        usePathnameMock.mockReturnValue(pathname);

        render(
            <LiffAppShell>
                <main id="main">IT content</main>
            </LiffAppShell>,
        );

        expect(screen.getByRole("link", { name: "IT" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.it,
        );
        expect(screen.getByRole("link", { name: "IT" })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByText("บริการ IT")).toBeInTheDocument();
    });

    it.each([
        [APP_ROUTES.line.root, "หน้าหลัก", "บริการของฉัน"],
        [APP_ROUTES.line.stock, "วัสดุ", "บริการวัสดุ"],
        [APP_ROUTES.line.leave, "วันลา", "บริการวันลา"],
        [APP_ROUTES.line.routine, "งานประจำ", "งานประจำ"],
    ])("preserves the %s navigation section", (pathname, label, section) => {
        usePathnameMock.mockReturnValue(pathname);

        render(
            <LiffAppShell>
                <main id="main">Module content</main>
            </LiffAppShell>,
        );

        expect(screen.getByRole("link", { name: label })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(within(screen.getByRole("banner")).getByText(section)).toBeInTheDocument();
    });
});
