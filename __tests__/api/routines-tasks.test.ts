import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/lib/services/routine", () => ({
    RoutineServiceError: class RoutineServiceError extends Error {},
    getRoutineTasks: mocks.getTasks,
    createRoutineTask: mocks.createTask,
}));

import { GET, POST } from "@/app/api/routines/tasks/route";

describe("GET /api/routines/tasks active filter semantics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.getTasks.mockResolvedValue({
            tasks: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        });
        mocks.createTask.mockResolvedValue({ task: { id: 1 }, replayed: false });
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

    it.each([
        ["active", "active"],
        ["inactive", "inactive"],
    ])("passes the %s status filter to the service", async (_label, status) => {
        const response = await GET(
            new NextRequest(`http://localhost/api/routines/tasks?status=${status}`),
        );

        expect(response.status).toBe(200);
        expect(mocks.getTasks.mock.calls[0]?.[0]?.status).toBe(status);
    });

    it("passes unit and category filters to the service together", async () => {
        const response = await GET(
            new NextRequest("http://localhost/api/routines/tasks?unitId=3&categoryId=5"),
        );

        expect(response.status).toBe(200);
        expect(mocks.getTasks).toHaveBeenCalledWith(
            expect.objectContaining({ unitId: 3, categoryId: 5 }),
            expect.any(Object),
        );
    });

    it("passes a regular user's actor scope to the management query", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/tasks"),
        );

        expect(response.status).toBe(200);
        expect(mocks.getTasks).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                actor: expect.objectContaining({ id: 5, role: "USER" }),
                employeeId: 21,
            }),
        );
    });
});

describe("POST /api/routines/tasks idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.createTask.mockResolvedValue({ task: { id: 1 }, replayed: false });
    });

    const payload = {
        unitId: 1,
        categoryId: 1,
        title: "ตรวจสอบระบบ",
        scheduleType: "MONTHLY_DAY",
        scheduleConfig: { day: 10, monthOffset: 0 },
        assignees: [{ employeeId: 11, role: "OWNER" }],
        reminderRules: [],
    };

    it("requires an idempotency key and passes it to the service", async () => {
        const response = await POST(
            new NextRequest("http://localhost/api/routines/tasks", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "idempotency-key": "routine-create-1",
                },
                body: JSON.stringify(payload),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.createTask).toHaveBeenCalledWith(
            expect.objectContaining({ title: "ตรวจสอบระบบ" }),
            expect.objectContaining({ id: 99 }),
            { idempotencyKey: "routine-create-1" },
        );
    });

    it("does not call the mutation service without an idempotency key", async () => {
        const response = await POST(
            new NextRequest("http://localhost/api/routines/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
            }),
        );

        expect(response.status).toBe(400);
        expect(mocks.createTask).not.toHaveBeenCalled();
    });

    it("returns success without creating a second task for a replay", async () => {
        mocks.createTask.mockResolvedValue({ task: { id: 1 }, replayed: true });
        const response = await POST(
            new NextRequest("http://localhost/api/routines/tasks", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "idempotency-key": "routine-create-1",
                },
                body: JSON.stringify(payload),
            }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ replayed: true });
    });
});
