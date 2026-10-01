import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import type * as NextServerModule from "next/server";
import type * as AuthorizationModule from "@/modules/authorization";
import { prisma } from "@/lib/db/prisma";
import { authorization } from "@/modules/authorization";
import { requireApiSession } from "@/lib/auth/api";
import { processOutbox } from "@/lib/services/outbox/processor";
import { enforcePreAuthIpRateLimit, enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { PATCH } from "@/app/api/email-request/[id]/access-requirements/route";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/lib/auth/api", () => ({ requireApiSession: vi.fn() }));
vi.mock("@/lib/services/outbox/processor", () => ({ processOutbox: vi.fn() }));
vi.mock("@/lib/security/mutation-rate-limit", () => ({ enforcePreAuthIpRateLimit: vi.fn(), enforceAuthenticatedMutationRateLimit: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...await original<typeof NextServerModule>(), after: vi.fn((callback) => callback()) }));
vi.mock("@/modules/authorization", async (original) => ({ ...await original<typeof AuthorizationModule>(),
    authorization: { resolveInTransaction: vi.fn() } }));
const db = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const user = { id: 7, name: "ผู้ส่ง", role: "USER", email: "requester@example.com" };
const row = { id: 128, thaiName: "สมชาย", englishName: "Somchai", nickname: "ชาย", phone: "081-2345678", position: "IT", department: "มสช.",
    replyEmail: "reply@example.com", requestedBy: 7, needsDocumentSystem: false,
    documentSystemDecision: "UNDECIDED" as const, sharedDriveDecision: "UNDECIDED" as const, sharedDriveAccess: [], accessVersion: 1,
    createdAt: new Date(), updatedAt: new Date() };
const input = { documentSystemDecision: "REQUIRED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [], expectedAccessVersion: 1 };
function call(body: unknown = input, id = "128"): Promise<NextResponse> {
    return PATCH(new NextRequest(`http://localhost/api/email-request/${id}/access-requirements`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
}
describe("PATCH Email Request access requirements (real command boundary)", () => {
    beforeEach(() => {
        mockReset(db);
        vi.clearAllMocks();
        vi.mocked(enforcePreAuthIpRateLimit).mockReturnValue(null);
        vi.mocked(enforceAuthenticatedMutationRateLimit).mockReturnValue(null);
        vi.mocked(requireApiSession).mockResolvedValue({ ok: true, user, session: { user: { ...user, id: "7" } } });
        vi.mocked(authorization.resolveInTransaction).mockResolvedValue({ capability: "email.request.update", allowed: true, scopes: ["OWN"], grants: [] });
        vi.mocked(processOutbox).mockResolvedValue({} as Awaited<ReturnType<typeof processOutbox>>);
        db.$transaction.mockImplementation(async (operation) => Array.isArray(operation) ? Promise.all(operation) : operation(db));
        db.emailRequest.findUnique.mockResolvedValue(row);
        db.emailRequest.updateMany.mockResolvedValue({ count: 1 });
    });
    it("allows OWN for the original requester and wakes the durable outbox", async () => {
        expect((await call()).status).toBe(200);
        expect(db.emailRequestAccessChange.create).toHaveBeenCalledTimes(1);
        expect(processOutbox).toHaveBeenCalledTimes(1);
    });
    it("denies direct access to another request even for a forged UI", async () => {
        db.emailRequest.findUnique.mockResolvedValue({ ...row, requestedBy: 8 });
        expect((await call()).status).toBe(403);
        expect(db.emailRequest.updateMany).not.toHaveBeenCalled();
    });
    it("allows ALL on another request", async () => {
        vi.mocked(authorization.resolveInTransaction).mockResolvedValue({ capability: "email.request.update", allowed: true, scopes: ["ALL"], grants: [] });
        db.emailRequest.findUnique.mockResolvedValue({ ...row, requestedBy: 8 });
        expect((await call()).status).toBe(200);
    });
    it("denies no grant and unauthenticated callers", async () => {
        vi.mocked(authorization.resolveInTransaction).mockResolvedValue({ capability: "email.request.update", allowed: false, scopes: [], grants: [], reason: "NO_APPLICABLE_GRANT" });
        expect((await call()).status).toBe(403);
        vi.mocked(requireApiSession).mockResolvedValue({ ok: false, response: NextResponse.json({ success: false }, { status: 401 }) });
        expect((await call()).status).toBe(401);
        expect(db.emailRequest.updateMany).not.toHaveBeenCalled();
    });
    it("returns 409 for a stale expected version", async () => {
        db.emailRequest.findUnique.mockResolvedValue({ ...row, accessVersion: 2 });
        expect((await call()).status).toBe(409);
        expect(processOutbox).not.toHaveBeenCalled();
    });
    it("returns current data for no-op without mutation or outbox wakeup", async () => {
        const response = await call({ ...input, documentSystemDecision: "UNDECIDED" });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ changed: false, data: { accessVersion: 1 } });
        expect(db.emailRequest.updateMany).not.toHaveBeenCalled();
        expect(processOutbox).not.toHaveBeenCalled();
    });
    it.each([
        { ...input, sharedDriveDecision: "REQUIRED" },
        { ...input, sharedDriveAccess: ["it"] },
        { ...input, sharedDriveDecision: "NOT_REQUIRED", sharedDriveAccess: ["it"] },
        { ...input, phone: "999" }, { ...input, expectedAccessVersion: 0 },
    ])("rejects contradictory or out-of-scope payload %#", async (body) => {
        expect((await call(body)).status).toBe(400);
        expect(db.$transaction).not.toHaveBeenCalled();
    });
    it("bounds malformed and oversized bodies", async () => {
        const response = await PATCH(new NextRequest("http://localhost/api/email-request/128/access-requirements", { method: "PATCH", body: "{" }), { params: Promise.resolve({ id: "128" }) });
        expect(response.status).toBe(400);
        expect((await call({ padding: "x".repeat(5000) })).status).toBe(413);
        expect((await call(input, "1.5")).status).toBe(400);
    });

    it("rate limits before mutation and before authentication for the IP gate", async () => {
        vi.mocked(enforcePreAuthIpRateLimit).mockReturnValue(NextResponse.json({ error: "จำกัดคำขอ" }, { status: 429 }));
        expect((await call()).status).toBe(429);
        expect(requireApiSession).not.toHaveBeenCalled();
        vi.mocked(enforcePreAuthIpRateLimit).mockReturnValue(null);
        vi.mocked(enforceAuthenticatedMutationRateLimit).mockReturnValue(NextResponse.json({ error: "จำกัดคำขอ" }, { status: 429 }));
        expect((await call()).status).toBe(429);
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});
