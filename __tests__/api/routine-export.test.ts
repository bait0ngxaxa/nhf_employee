import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as NextServerModule from "next/server";

const mocks = vi.hoisted(() => ({
    requireSession: vi.fn(),
    prepareExport: vi.fn(),
    logDataExport: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireSession,
}));

vi.mock("@/lib/server/audit", () => ({
    logDataExport: mocks.logDataExport,
}));

vi.mock("@/modules/routine", async (importOriginal) => ({
    ...(await importOriginal()),
    prepareRoutineTaskExport: mocks.prepareExport,
}));

import { GET } from "@/app/api/routines/export/route";

describe("GET /api/routines/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });
        mocks.prepareExport.mockResolvedValue({
            status: "ready",
            recordCount: 2,
            response: new Response("xlsx", {
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
            }),
        });
    });

    it("rejects unauthenticated exports", async () => {
        mocks.requireSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 }),
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/export?format=xlsx"),
        );

        expect(response.status).toBe(401);
        expect(mocks.prepareExport).not.toHaveBeenCalled();
    });

    it("exports all tasks for a non-admin and audits the authenticated actor", async () => {
        const response = await GET(
            new NextRequest("http://localhost/api/routines/export?format=xlsx"),
        );

        expect(response.status).toBe(200);
        expect(mocks.prepareExport).toHaveBeenCalledWith(
            expect.objectContaining({
                employeeId: 21,
                actor: expect.objectContaining({ id: 5, role: "USER" }),
            }),
        );
        expect(mocks.logDataExport).toHaveBeenCalledWith(
            "RoutineTask",
            5,
            "user@example.com",
            expect.objectContaining({
                metadata: expect.objectContaining({
                    entityType: "RoutineTask",
                    recordCount: 2,
                    filters: { scope: "all", format: "xlsx" },
                }),
            }),
        );
    });

    it("allows an Admin export without an employee profile", async () => {
        mocks.requireSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/export?format=xlsx"),
        );

        expect(response.status).toBe(200);
        expect(mocks.prepareExport).toHaveBeenCalledWith(
            expect.objectContaining({ employeeId: null }),
        );
        expect(mocks.logDataExport).toHaveBeenCalledWith(
            "RoutineTask",
            99,
            "admin@example.com",
            expect.any(Object),
        );
    });

    it("enforces the export row limit before creating an audit", async () => {
        mocks.prepareExport.mockResolvedValue({
            status: "limit-exceeded",
            recordCount: 2001,
            maxRows: 2000,
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/export?format=xlsx"),
        );

        expect(response.status).toBe(400);
        expect(mocks.logDataExport).not.toHaveBeenCalled();
    });
});
