// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock("@/app/_lib/auth/current-user", () => ({ getCurrentUserProjection: mocks.currentUser }));
vi.mock("next/navigation", () => ({ redirect: (target: string): never => { throw new Error(`REDIRECT:${target}`); } }));
vi.mock("@/components/dashboard/context", () => ({ DashboardProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/dashboard/layout/DashboardLayoutClient", () => ({ DashboardLayoutClient: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/dashboard/sections/DashboardMoreSection", () => ({ DashboardMoreSection: () => <h1>เพิ่มเติม</h1> }));

import DashboardLayout from "@/app/dashboard/layout";
import MorePage from "@/app/dashboard/more/page";
import { getDashboardMenuIdFromPathname, toDashboardMenuPath } from "@/lib/ssot/routes";

beforeEach(() => vi.clearAllMocks());

describe("More direct URL boundary", () => {
    it("registers its canonical destination and menu identity", () => {
        expect(toDashboardMenuPath("more")).toBe("/dashboard/more");
        expect(getDashboardMenuIdFromPathname("/dashboard/more")).toBe("more");
    });

    it("inherits server authentication before rendering a direct More request", async () => {
        mocks.currentUser.mockResolvedValue(null);
        await expect(DashboardLayout({ children: <MorePage /> })).rejects.toThrow("REDIRECT:/login");
        mocks.currentUser.mockResolvedValue({ id: "1", role: "USER" });
        const markup = renderToStaticMarkup(await DashboardLayout({ children: <MorePage /> }));
        expect(markup).toContain("เพิ่มเติม");
    });
});
