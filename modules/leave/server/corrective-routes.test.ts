import type * as AmendmentModule from "@/modules/leave/application/requests/amend-special-reason";
import type * as AuthorizationModule from "../application/authorization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({ dashboard: vi.fn(), liff: vi.fn(), quota: vi.fn(), capability: vi.fn(), amend: vi.fn() }));
vi.mock("@/lib/auth/workforce", () => ({ requireActiveWorkforceSession: mocks.dashboard }));
vi.mock("@/modules/line", () => ({ requireLiffWorkforceSession: mocks.liff }));
vi.mock("@/modules/leave/application/requests/amend-special-reason", async (original) => ({ ...await original<typeof AmendmentModule>(), amendPendingLeaveSpecialReason: mocks.amend }));
vi.mock("../application/authorization", async (original) => ({ ...await original<typeof AuthorizationModule>(), assertLeaveCapability: mocks.capability }));
vi.mock("../application/queries/quota-projection", () => ({ getEmployeeLeaveQuotaProjection: mocks.quota }));

import { GET as dashboardGet } from "@/app/api/leave/me/route";
import { GET as liffGet } from "@/app/api/line/leave/me/route";
import { PUT as dashboardPut } from "@/app/api/leave/special-reason/route";
import { PUT as liffPut } from "@/app/api/line/leave/special-reason/route";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { LeaveAmendmentError } from "../application/requests/amend-special-reason";
import { LeaveCapabilityDeniedError } from "../application/authorization";

const auth = { ok: true, user: { id: 7, role: "USER", email: "employee@example.test" }, employeeId: 31 };
const payload = { leaveId: "leave-1", specialReason: "จำเป็นต้องดูแลครอบครัว", expectedSpecialReason: null };

describe.each([
    { channel: "DASHBOARD", path: "/api/leave", session: mocks.dashboard, get: dashboardGet, put: dashboardPut },
    { channel: "LIFF_SELF_SERVICE", path: "/api/line/leave", session: mocks.liff, get: liffGet, put: liffPut },
])("$channel corrective routes", ({ channel, path, session, get, put }) => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMutationRateLimit();
        session.mockResolvedValue(auth);
        mocks.capability.mockResolvedValue({ scopes: ["OWN"] });
        mocks.quota.mockResolvedValue([]);
        mocks.amend.mockResolvedValue({ request: { id: "leave-1", status: "PENDING", specialReason: payload.specialReason } });
    });
    const request = (body: unknown = payload, headers: Record<string, string> = {}): NextRequest => new NextRequest(`http://localhost${path}/special-reason`, { method: "PUT", headers: { origin: "http://localhost", "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

    it("reads a strict year with own identity and no history query", async () => {
        const response = await get(new Request(`http://localhost${path}/me?quotaYear=2031&employeeId=999`));
        expect(response.status).toBe(200);
        expect(mocks.quota).toHaveBeenCalledWith(31, 2031);
        expect(mocks.capability).toHaveBeenCalledWith({ authorizationActor: expect.objectContaining({ employeeId: 31, channel }) }, "leave.request.read");
    });
    it.each(["", "2031abc", "2031.5", "-2031", "NaN", "Infinity", "1999", "2101", "2031&quotaYear=2032"])("rejects quotaYear=%s", async (year) => {
        expect((await get(new Request(`http://localhost${path}/me?quotaYear=${year}`))).status).toBe(400);
        expect(mocks.quota).not.toHaveBeenCalled();
    });
    it("does not accept non-own scope or missing capability for projection", async () => {
        mocks.capability.mockResolvedValueOnce({ scopes: ["ASSIGNED"], capability: "leave.request.read", decision: { reason: "NO_APPLICABLE_GRANT" } });
        expect((await get(new Request(`http://localhost${path}/me?quotaYear=2031`))).status).toBe(403);
        mocks.capability.mockRejectedValueOnce(new LeaveCapabilityDeniedError("leave.request.read", "NO_APPLICABLE_GRANT"));
        expect((await get(new Request(`http://localhost${path}/me?quotaYear=2031`))).status).toBe(403);
        expect(mocks.quota).not.toHaveBeenCalled();
    });
    it("passes only session identity and channel to the amendment", async () => {
        expect((await put(request())).status).toBe(200);
        expect(mocks.amend).toHaveBeenCalledWith({ userEmail: auth.user.email, authorization: { authorizationActor: expect.objectContaining({ userId: 7, employeeId: 31, channel }) } }, payload);
    });
    it("rejects unauthenticated reads and mutations", async () => {
        session.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) });
        expect((await put(request())).status).toBe(401);
        expect((await get(new Request(`http://localhost${path}/me?quotaYear=2031`))).status).toBe(401);
        expect(mocks.amend).not.toHaveBeenCalled();
    });
    it("requires trusted origin and AJAX header", async () => {
        expect((await put(request(payload, { origin: "https://untrusted.test" }))).status).toBe(403);
        expect((await put(request(payload, { "X-Requested-With": "" }))).status).toBe(403);
        expect(mocks.amend).not.toHaveBeenCalled();
    });
    it.each([{ ...payload, employeeId: 999 }, { ...payload, specialReason: "1234" }, { ...payload, specialReason: "x".repeat(1001) }, { ...payload, status: "APPROVED" }])("rejects invalid/extra amendment input", async (body) => {
        expect((await put(request(body))).status).toBe(400);
        expect(mocks.amend).not.toHaveBeenCalled();
    });
    it("bounds streamed input and maps owner/status/capability errors", async () => {
        expect((await put(request({ ...payload, specialReason: "x".repeat(100_000) }))).status).toBe(413);
        for (const status of [404, 409]) {
            mocks.amend.mockRejectedValueOnce(new LeaveAmendmentError("กรุณารีเฟรชรายการ", status));
            expect((await put(request())).status).toBe(status);
        }
        mocks.amend.mockRejectedValueOnce(new LeaveCapabilityDeniedError("leave.request.create", "NO_APPLICABLE_GRANT"));
        expect((await put(request())).status).toBe(403);
    });
});
