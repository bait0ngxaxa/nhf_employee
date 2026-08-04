import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/services/routine", () => ({
    getRoutineTasks: mocks.getTasks,
    createRoutineTask: mocks.createTask,
}));

import { GET } from "@/app/api/routines/tasks/route";

describe("GET /api/routines/tasks active filter semantics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.getTasks.mockResolvedValue({
            tasks: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
    });

    it.each([
        ["no filter", "", undefined],
        ["activeOnly=0", "?activeOnly=0", undefined],
        ["activeOnly=1", "?activeOnly=1", true],
    ])("passes %s as the correct service semantics", async (_label, query, expected) => {
        const response = await GET(
            new NextRequest(`http://localhost/api/routines/tasks${query}`),
        );

        expect(response.status).toBe(200);
        expect(mocks.getTasks).toHaveBeenCalledTimes(1);
        expect(mocks.getTasks.mock.calls[0]?.[0]?.activeOnly).toBe(expected);
    });
});
