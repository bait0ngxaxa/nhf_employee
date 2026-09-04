import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
    getReference: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/modules/routine", async (importOriginal) => ({
    ...(await importOriginal()),
    getRoutineReferenceData: mocks.getReference,
}));

import { GET } from "@/app/api/routines/reference/route";

describe("GET /api/routines/reference", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.getReference.mockResolvedValue({
            units: [],
            categories: [],
            employees: [],
        });
    });

    it("allows an admin to request all reference employees", async () => {
        const response = await GET(
            new NextRequest("http://localhost/api/routines/reference"),
        );

        expect(response.status).toBe(200);
        expect(mocks.getReference).toHaveBeenCalledWith(
            expect.objectContaining({
                actor: expect.objectContaining({ id: 99, role: "ADMIN" }),
                employeeId: null,
            }),
        );
    });

    it("passes a regular user's identity so the service can return only self", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/reference"),
        );

        expect(response.status).toBe(200);
        expect(mocks.getReference).toHaveBeenCalledWith(
            expect.objectContaining({
                actor: expect.objectContaining({ id: 5, role: "USER" }),
                employeeId: 21,
            }),
        );
    });

    it("does not call the reference service for an unauthorized session", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 }),
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/reference"),
        );

        expect(response.status).toBe(403);
        expect(mocks.getReference).not.toHaveBeenCalled();
    });
});
