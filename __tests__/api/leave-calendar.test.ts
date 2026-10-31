import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as LeaveModule from "@/modules/leave";
import { GET, POST } from "@/app/api/leave/calendar/manage/route";
import { GET as published } from "@/app/api/leave/calendar/route";
import { GET as impact } from "@/app/api/leave/calendar/impact/route";
import { POST as reconcile } from "@/app/api/leave/calendar/reconcile/route";
import { requireAdminSession, requireApiSession } from "@/lib/auth/api";
import { getCalendarImpact, reconcileCalendarLeave, getManagedHolidayCalendar, getPublishedHolidayCalendar, mutateHolidayCalendar } from "@/modules/leave";

vi.mock("@/lib/auth/api", () => ({ requireAdminSession: vi.fn(), requireApiSession: vi.fn() }));
vi.mock("@/lib/security/mutation-rate-limit", () => ({ enforcePreAuthIpRateLimit: vi.fn(), enforceAuthenticatedMutationRateLimit: vi.fn() }));
vi.mock("@/modules/leave", async (importOriginal) => {
    const contracts = await importOriginal<typeof LeaveModule>();
    return { ...contracts, getManagedHolidayCalendar: vi.fn(), getPublishedHolidayCalendar: vi.fn(), mutateHolidayCalendar: vi.fn(), getCalendarImpact: vi.fn(), reconcileCalendarLeave: vi.fn() };
});

function request(trusted = true): NextRequest {
    return new NextRequest("http://localhost/api/leave/calendar/manage?year=2027", { method: "POST", headers: trusted ? { Origin: "http://localhost", "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json" } : {}, body: JSON.stringify({ action: "create", year: 2027, expectedActiveVersion: null, role: "ADMIN" }) });
}

describe("calendar API session boundaries", () => {
    beforeEach(() => vi.clearAllMocks());
    it.each([401, 403])("returns %i from the trusted server session guard", async (status) => {
        vi.mocked(requireAdminSession).mockResolvedValue({ ok: false, response: NextResponse.json({ error: "denied" }, { status }) });
        expect((await POST(request())).status).toBe(status);
        expect((await GET(request())).status).toBe(status);
        expect((await impact(request())).status).toBe(status);
        expect((await reconcile(request())).status).toBe(status);
        expect(mutateHolidayCalendar).not.toHaveBeenCalled();
        expect(getManagedHolidayCalendar).not.toHaveBeenCalled();
        expect(getCalendarImpact).not.toHaveBeenCalled();
        expect(reconcileCalendarLeave).not.toHaveBeenCalled();
    });
    it("rejects cross-origin or LIFF bearer-only writes before mutation", async () => {
        expect((await POST(request(false))).status).toBe(403);
        expect(mutateHolidayCalendar).not.toHaveBeenCalled();
    });
    it("does not accept LIFF bearer identity as a Dashboard ADMIN session", async () => {
        vi.mocked(requireAdminSession).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
        const liff = new NextRequest("http://localhost/api/leave/calendar/manage?year=2027", {
            method: "POST", headers: { Origin: "http://localhost", "X-Requested-With": "XMLHttpRequest", Authorization: "Bearer liff-session-only" },
            body: JSON.stringify({ action: "create", year: 2027, expectedActiveVersion: null }),
        });
        expect((await POST(liff)).status).toBe(401);
        expect((await impact(liff)).status).toBe(401);
        expect((await reconcile(liff)).status).toBe(401);
        expect(mutateHolidayCalendar).not.toHaveBeenCalled();
        expect(reconcileCalendarLeave).not.toHaveBeenCalled();
    });
    it("derives the control-plane identity from session, never JSON", async () => {
        vi.mocked(requireAdminSession).mockResolvedValue({ ok: true, user: { id: 7, role: "ADMIN", email: "a@test", name: "A" }, session: {} } as never);
        vi.mocked(mutateHolidayCalendar).mockResolvedValue({ year: 2027, activeVersionNumber: null, versions: [] });
        expect((await POST(request())).status).toBe(200);
        expect(mutateHolidayCalendar).toHaveBeenCalledWith({ userId: 7, channel: "DASHBOARD" }, expect.objectContaining({ year: 2027 }));
    });
    it("published read uses only the published projection and requires authentication", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
        expect((await published(request())).status).toBe(401);
        vi.mocked(requireApiSession).mockResolvedValue({ ok: true, user: { id: 2, role: "USER", email: "u@test", name: "U" }, session: {} } as never);
        vi.mocked(getPublishedHolidayCalendar).mockResolvedValue({ year: 2027, version: null, days: [] });
        const response = await published(request());
        expect(await response.json()).toEqual({ year: 2027, version: null, days: [] });
        expect(getManagedHolidayCalendar).not.toHaveBeenCalled();
    });
});
