import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    deleteTask: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/services/routine", () => ({
    deleteRoutineTask: mocks.deleteTask,
    getRoutineTaskById: vi.fn(),
    updateRoutineTask: vi.fn(),
}));

import { DELETE } from "@/app/api/routines/tasks/[id]/route";

describe("DELETE /api/routines/tasks/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
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
        mocks.requireAdminSession.mockResolvedValue({
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
});
