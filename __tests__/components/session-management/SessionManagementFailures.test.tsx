import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionManagementSection } from "@/components/dashboard/sections/SessionManagementSection";
import type { SessionItem } from "@/components/dashboard/session-management/types";
import { API_ROUTES } from "@/lib/ssot/routes";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock("@/components/dashboard/context/dashboard/DashboardContext", () => ({
    useDashboardUIContext: () => ({ handleSignOut: signOut }),
}));

vi.mock("sonner", () => ({
    toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

const fetchMock = vi.fn<typeof fetch>();
const diagnostic = "SQL connection failed: internal-host:3306";
const browser = "Mozilla/5.0 (Windows NT 10.0) Chrome/131.0";

function session(id: string, isCurrent = false, userAgent = browser): SessionItem {
    return {
        id,
        familyId: id,
        isCurrent,
        userAgent,
        ipAddress: null,
        lastUsedAt: null,
        createdAt: "2026-10-01T08:00:00.000Z",
        expiresAt: "2026-12-01T08:00:00.000Z",
    };
}

function response(body: unknown, status = 200): Response {
    return Response.json(body, { status });
}

function renderSessionManagement(): void {
    render(
        <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
            <SessionManagementSection />
        </SWRConfig>,
    );
}

function requestsTo(route: string): unknown[] {
    return fetchMock.mock.calls.filter(([url]) => String(url) === route);
}

describe("session management", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => vi.unstubAllGlobals());

    it("shows a safe revocation toast and does not automatically replay the POST", async () => {
        fetchMock.mockImplementation(async (url) =>
            String(url) === API_ROUTES.auth.sessions
                ? response({ sessions: [session("remote")] })
                : response({ error: diagnostic }, 500),
        );
        renderSessionManagement();

        fireEvent.click(await screen.findByRole("button", { name: /ออกจากระบบ.*Google Chrome/ }));
        fireEvent.click(screen.getByRole("button", { name: "ยืนยัน" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledExactlyOnceWith(
            "ออกจากระบบรายการนี้ไม่สำเร็จ กรุณาโหลดรายการล่าสุด",
        ));
        expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain(diagnostic);
        expect(requestsTo(API_ROUTES.auth.revokeSession)).toHaveLength(1);
    });

    it("counts separate sign-ins and revokes only the chosen remote entry", async () => {
        let sessions = [
            session("current", true),
            session("same-browser"),
            session("phone", false, "Mozilla/5.0 (Android 13; Mobile) Firefox/131.0"),
        ];
        const postedIds: string[] = [];
        fetchMock.mockImplementation(async (url, init) => {
            if (String(url) === API_ROUTES.auth.sessions) return response({ sessions });
            const body = JSON.parse(String(init?.body)) as { sessionId: string };
            postedIds.push(body.sessionId);
            sessions = sessions.filter(({ id }) => id !== body.sessionId);
            return response({ success: true });
        });
        renderSessionManagement();

        expect(await screen.findByText("ทั้งหมด 3 รายการ")).toBeVisible();
        expect(screen.getAllByText("Google Chrome")).toHaveLength(2);
        expect(screen.getByText("Mozilla Firefox")).toBeVisible();
        expect(screen.getByText(/อุปกรณ์เดียวอาจมีหลายรายการ/)).toBeVisible();
        const current = screen.getByText("รายการปัจจุบัน").closest("li");
        if (!current) throw new Error("Expected a current sign-in row");
        expect(within(current).queryByRole("button")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /ออกจากระบบรายการนี้ Google Chrome/ }));
        const dialog = screen.getByRole("dialog", { name: "ยืนยันออกจากระบบรายการนี้?" });
        expect(dialog).toHaveTextContent("รายการเข้าสู่ระบบนี้จะใช้งานต่อไม่ได้และต้องเข้าสู่ระบบใหม่");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยัน" }));

        expect(await screen.findByText("ทั้งหมด 2 รายการ")).toBeVisible();
        expect(postedIds).toEqual(["same-browser"]);
        expect(screen.getByText("รายการปัจจุบัน")).toBeVisible();
        expect(signOut).not.toHaveBeenCalled();
    });

    it("keeps the current sign-in and reports partial failure when signing out other entries", async () => {
        let sessions = [session("current", true), session("succeeds"), session("fails")];
        const postedIds: string[] = [];
        fetchMock.mockImplementation(async (url, init) => {
            if (String(url) === API_ROUTES.auth.sessions) return response({ sessions });
            const body = JSON.parse(String(init?.body)) as { sessionId: string };
            postedIds.push(body.sessionId);
            if (body.sessionId === "fails") return response({ error: diagnostic }, 500);
            sessions = sessions.filter(({ id }) => id !== body.sessionId);
            return response({ success: true });
        });
        renderSessionManagement();

        fireEvent.click(await screen.findByRole("button", { name: "ออกจากระบบรายการอื่นทั้งหมด" }));
        const dialog = screen.getByRole("dialog", { name: "ยืนยันออกจากระบบรายการอื่นทั้งหมด?" });
        expect(dialog).toHaveTextContent("คุณจะยังใช้งานรายการปัจจุบันต่อได้");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยัน" }));

        expect(await screen.findByText("ทั้งหมด 2 รายการ")).toBeVisible();
        expect(postedIds.sort()).toEqual(["fails", "succeeds"]);
        expect(screen.getByText("รายการปัจจุบัน")).toBeVisible();
        expect(toast.error).toHaveBeenCalledExactlyOnceWith(
            "ออกจากระบบไม่สำเร็จ 1 รายการ",
            { description: "ออกจากระบบรายการนี้ไม่สำเร็จ กรุณาโหลดรายการล่าสุด" },
        );
        expect(toast.success).not.toHaveBeenCalled();
        expect(signOut).not.toHaveBeenCalled();
    });

    it("uses the current sign-out flow without revoking another entry", async () => {
        fetchMock.mockImplementation(async () => response({ sessions: [session("current", true)] }));
        renderSessionManagement();

        fireEvent.click(await screen.findByRole("button", { name: "ออกจากระบบที่กำลังใช้งาน" }));
        const dialog = screen.getByRole("dialog", { name: "ยืนยันออกจากระบบที่กำลังใช้งาน?" });
        expect(dialog).toHaveTextContent("คุณจะออกจากรายการเข้าสู่ระบบที่กำลังใช้งานทันที");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยัน" }));

        expect(signOut).toHaveBeenCalledTimes(1);
        expect(requestsTo(API_ROUTES.auth.revokeSession)).toHaveLength(0);
    });

    it("shows an empty list without offering to revoke other entries", async () => {
        fetchMock.mockImplementation(async () => response({ sessions: [] }));
        renderSessionManagement();

        expect(await screen.findByText("ไม่พบรายการเข้าสู่ระบบ")).toBeVisible();
        expect(screen.getByText("ทั้งหมด 0 รายการ")).toBeVisible();
        expect(screen.getByRole("button", { name: "ออกจากระบบรายการอื่นทั้งหมด" })).toBeDisabled();
    });

    it("keeps a list failure visible and allows a manual retry", async () => {
        let denied = true;
        fetchMock.mockImplementation(async () => denied
            ? response({ error: `ข้อมูลภายใน ${diagnostic}` }, 403)
            : response({ sessions: [session("current", true)] }));
        renderSessionManagement();

        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("บัญชีนี้เปิดรายการเข้าสู่ระบบไม่ได้");
        expect(alert).not.toHaveTextContent(diagnostic);
        denied = false;
        fireEvent.click(screen.getByRole("button", { name: "โหลดใหม่" }));

        expect(await screen.findByText("Google Chrome")).toBeVisible();
        expect(requestsTo(API_ROUTES.auth.sessions)).toHaveLength(2);
    });
});
