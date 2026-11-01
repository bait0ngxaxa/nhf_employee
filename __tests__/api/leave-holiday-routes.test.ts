import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dashboardAuth: vi.fn(), liffAuth: vi.fn(), reference: vi.fn() }));
vi.mock("@/lib/auth/workforce", () => ({ requireActiveWorkforceSession: mocks.dashboardAuth }));
vi.mock("@/modules/line", () => ({ requireLiffWorkforceSession: mocks.liffAuth }));
vi.mock("@/modules/leave", () => ({ getHolidayReferenceResponse: mocks.reference }));

import { GET as dashboardGet } from "@/app/api/leave/holidays/route";
import { GET as liffGet } from "@/app/api/line/leave/holidays/route";

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
    mocks.dashboardAuth.mockResolvedValue({ ok: true, employeeId: 1 });
    mocks.liffAuth.mockResolvedValue({ ok: true, employeeId: 2 });
    mocks.reference.mockResolvedValue(NextResponse.json({ year: 2026, events: [] }));
});
afterEach(() => vi.unstubAllEnvs());

describe.each([
    ["Dashboard", dashboardGet, mocks.dashboardAuth, mocks.liffAuth],
    ["LIFF", liffGet, mocks.liffAuth, mocks.dashboardAuth],
] as const)("%s read-only holiday route", (_channel, get, auth, otherAuth) => {
    it("requires its own workforce session before reading public reference data", async () => {
        expect((await get()).status).toBe(200);
        expect(auth).toHaveBeenCalledOnce();
        expect(otherAuth).not.toHaveBeenCalled();
        expect(mocks.reference).toHaveBeenCalledWith();
    });
    it.each([401, 403, 404])("preserves workforce rejection %i without fetching holidays", async (status) => {
        auth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
        expect((await get()).status).toBe(status);
        expect(mocks.reference).not.toHaveBeenCalled();
    });
    it("gates disabled Leave before authentication and retrieval", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        expect((await get()).status).toBe(404);
        expect(auth).not.toHaveBeenCalled();
        expect(mocks.reference).not.toHaveBeenCalled();
    });
    it("fails closed and sanitizes unexpected authentication failures", async () => {
        auth.mockRejectedValue(new Error("private SQL or session details"));
        const result = await get();
        expect(result.status).toBe(500);
        expect(await result.text()).not.toContain("private SQL");
        expect(mocks.reference).not.toHaveBeenCalled();
    });
});
