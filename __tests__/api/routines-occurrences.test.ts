import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireSession: vi.fn(),
    getOccurrences: vi.fn(),
    getTaskWorkItems: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireSession,
}));

vi.mock("@/lib/services/routine", () => ({
    getRoutineOccurrences: mocks.getOccurrences,
    getRoutineTaskWorkItems: mocks.getTaskWorkItems,
}));

import { GET } from "@/app/api/routines/occurrences/route";

describe("GET /api/routines/occurrences", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireSession.mockResolvedValue({
            ok: true,
            user: {
                id: 5,
                email: "user@example.com",
                name: "ผู้ใช้งาน",
                role: "USER",
            },
            employeeId: 21,
        });
        mocks.getOccurrences.mockResolvedValue({
            occurrences: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
        mocks.getTaskWorkItems.mockResolvedValue({
            occurrences: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
    });

    it("passes the authenticated employee context to the query service", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/routines/occurrences?scope=all&assigneeId=999&occurrenceId=91&timingStatus=DUE_SOON&limit=20",
        ));

        expect(response.status).toBe(200);
        expect(mocks.getOccurrences).toHaveBeenCalledWith(
            expect.objectContaining({ scope: "all", assigneeId: 999, occurrenceId: 91, timingStatus: "DUE_SOON" }),
            expect.objectContaining({
                employeeId: 21,
                actor: expect.objectContaining({ id: 5, role: "USER" }),
            }),
        );
    });

    it("rejects invalid pagination before querying", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/routines/occurrences?limit=1000",
        ));

        expect(response.status).toBe(400);
        expect(mocks.getOccurrences).not.toHaveBeenCalled();
    });

    it("returns the authentication response without querying", async () => {
        const unauthorized = NextResponse.json(
            { error: "กรุณาเข้าสู่ระบบ" },
            { status: 401 },
        );
        mocks.requireSession.mockResolvedValue({ ok: false, response: unauthorized });

        const response = await GET(new NextRequest(
            "http://localhost/api/routines/occurrences",
        ));

        expect(response.status).toBe(401);
        expect(mocks.getOccurrences).not.toHaveBeenCalled();
    });

    it("supports the task-centric operational view with one row per task", async () => {
        const response = await GET(new NextRequest(
            "http://localhost/api/routines/occurrences?view=tasks&scope=all",
        ));

        expect(response.status).toBe(200);
        expect(mocks.getTaskWorkItems).toHaveBeenCalledWith(
            expect.objectContaining({ scope: "all" }),
            expect.objectContaining({ employeeId: 21 }),
        );
        expect(mocks.getOccurrences).not.toHaveBeenCalled();
    });
});
