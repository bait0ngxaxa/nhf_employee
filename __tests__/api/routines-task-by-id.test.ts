import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
    deleteTask: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/lib/services/routine", () => ({
    RoutineServiceError: class RoutineServiceError extends Error {},
    deleteRoutineTask: mocks.deleteTask,
    getRoutineTaskById: vi.fn(),
    updateRoutineTask: vi.fn(),
}));

import { DELETE } from "@/app/api/routines/tasks/[id]/route";

describe("DELETE /api/routines/tasks/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.deleteTask.mockResolvedValue(undefined);
    });

    it("authorizes an admin and deletes exactly the requested task", async () => {
        const response = await DELETE(
            new NextRequest("http://localhost/api/routines/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.deleteTask).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ id: 99, role: "ADMIN" }),
        );
    });

    it("does not invoke deletion for a non-admin session", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 }),
        });

        const response = await DELETE(
            new NextRequest("http://localhost/api/routines/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(403);
        expect(mocks.deleteTask).not.toHaveBeenCalled();
    });

    it("allows an active workforce user to request deletion", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        const response = await DELETE(
            new NextRequest("http://localhost/api/routines/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.deleteTask).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ id: 5, role: "USER" }),
        );
    });
});
