import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireSession: vi.fn(),
    getSummary: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireSession,
}));

vi.mock("@/lib/services/routine", () => ({
    getRoutineSummary: mocks.getSummary,
}));

import { GET } from "@/app/api/routines/summary/route";

describe("GET /api/routines/summary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });
        mocks.getSummary.mockResolvedValue({
            today: 1,
            dueSoon: 2,
            within30Days: 3,
            asOfDate: "2026-08-07",
        });
    });

    it("uses mine scope for a regular user", async () => {
        const response = await GET(new NextRequest("http://localhost/api/routines/summary"));

        expect(response.status).toBe(200);
        expect(mocks.getSummary).toHaveBeenCalledWith(expect.objectContaining({
            scope: "mine",
            employeeId: 21,
        }));
    });

    it("allows an admin to switch between mine and all scopes", async () => {
        mocks.requireSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });

        const mineResponse = await GET(new NextRequest("http://localhost/api/routines/summary?scope=mine"));
        const allResponse = await GET(new NextRequest("http://localhost/api/routines/summary?scope=all"));

        expect(mineResponse.status).toBe(200);
        expect(allResponse.status).toBe(200);
        expect(mocks.getSummary).toHaveBeenNthCalledWith(1, expect.objectContaining({ scope: "mine" }));
        expect(mocks.getSummary).toHaveBeenNthCalledWith(2, expect.objectContaining({ scope: "all" }));
    });

    it("rejects a regular user's request for the all scope before querying", async () => {
        const response = await GET(new NextRequest("http://localhost/api/routines/summary?scope=all"));

        expect(response.status).toBe(403);
        expect(mocks.getSummary).not.toHaveBeenCalled();
    });

    it("rejects an invalid scope", async () => {
        const response = await GET(new NextRequest("http://localhost/api/routines/summary?scope=unknown"));

        expect(response.status).toBe(400);
        expect(mocks.getSummary).not.toHaveBeenCalled();
    });

    it("returns an authentication response without querying", async () => {
        mocks.requireSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }),
        });

        const response = await GET(new NextRequest("http://localhost/api/routines/summary"));

        expect(response.status).toBe(401);
        expect(mocks.getSummary).not.toHaveBeenCalled();
    });
});
