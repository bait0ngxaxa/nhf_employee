import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("session management API failures", () => {
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
