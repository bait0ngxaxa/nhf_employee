// @vitest-environment node
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ session: vi.fn(), managed: vi.fn(), published: vi.fn(), employee: vi.fn(),
    manager: vi.fn(() => null), ticker: vi.fn(() => null), home: vi.fn(() => null) }));
vi.mock("@/lib/auth/api", () => ({ requireAdminSession: mocks.session, requireApiSession: mocks.employee }));
vi.mock("@/modules/announcements", () => ({ getManagedAnnouncement: mocks.managed, getPublishedAnnouncement: mocks.published }));
vi.mock("@/modules/announcements/client", () => ({ AnnouncementManager: mocks.manager, AnnouncementTicker: mocks.ticker }));
vi.mock("@/components/dashboard/sections/DashboardHomeSection", () => ({ DashboardHomeSection: mocks.home }));
vi.mock("next/navigation", () => ({ redirect: (path: string): never => { throw new Error(`REDIRECT:${path}`); } }));

import AnnouncementsPage from "@/app/dashboard/announcements/page";
import DashboardPage from "@/app/dashboard/page";

type AnnouncementSlot = ReactElement<Record<string, never>, () => Promise<ReactElement | null>>;

async function dashboardSlot(): Promise<AnnouncementSlot> {
    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const home = page.props.children as ReactElement<{ announcement: AnnouncementSlot }>;
    return home.props.announcement;
}

describe("Announcement Dashboard composition", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.session.mockResolvedValue({ ok: true, user: { id: 7, role: "ADMIN" } });
        mocks.employee.mockResolvedValue({ ok: true, user: { id: 8, role: "USER" } });
        mocks.managed.mockResolvedValue({ content: "ร่าง", version: 1, published: false });
        mocks.published.mockResolvedValue({ content: "ข่าว NHF" });
    });

    it.each([401, 403])("blocks direct management navigation with status %i", async (status) => {
        mocks.session.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status }) });
        await expect(AnnouncementsPage()).rejects.toThrow(status === 401 ? "REDIRECT:/login" : "REDIRECT:/access-denied");
        expect(mocks.managed).not.toHaveBeenCalled();
    });

    it("passes the trusted admin and server state to management", async () => {
        const page = await AnnouncementsPage();
        expect(mocks.managed).toHaveBeenCalledWith({ id: 7, role: "ADMIN" });
        expect(page.type).toBe(mocks.manager); expect(page.props).toMatchObject({ initialState: { content: "ร่าง" } });
    });

    it("reads fresh published content for the authenticated employee home slot", async () => {
        const slot = await dashboardSlot();
        const first = await slot.type();
        expect(first?.props).toMatchObject({ content: "ข่าว NHF" });
        mocks.published.mockResolvedValue(null);
        expect(await slot.type()).toBeNull();
        expect(mocks.published).toHaveBeenCalledTimes(2);
    });

    it("requires a session before querying the home announcement", async () => {
        const slot = await dashboardSlot();
        mocks.employee.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
        await expect(slot.type()).rejects.toThrow("REDIRECT:/login");
        expect(mocks.published).not.toHaveBeenCalled();
    });
});
