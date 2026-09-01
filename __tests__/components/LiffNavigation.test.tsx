import { render, screen } from "@testing-library/react";
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
        expect(screen.getByRole("link", { name: "Stock" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.stock,
        );
        expect(screen.getByRole("link", { name: "Leave" })).toHaveAttribute(
            "href",
            APP_ROUTES.line.leave,
        );
        expect(screen.getByRole("link", { name: "Routine" })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByText("Routine · งานประจำ")).toBeInTheDocument();
    });
});
