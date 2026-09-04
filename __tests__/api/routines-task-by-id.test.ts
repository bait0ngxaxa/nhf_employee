import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
        requireActiveWorkforceOrAdminSession: vi.fn(),
        deleteTask: vi.fn(),
        getTask: vi.fn(),
        updateTask: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/modules/routine", async (importOriginal) => ({
    ...(await importOriginal()),
    deleteRoutineTask: mocks.deleteTask,
    getRoutineTaskById: mocks.getTask,
    updateRoutineTask: mocks.updateTask,
}));

import {
    DELETE,
    GET,
    PATCH,
} from "@/app/api/routines/tasks/[id]/route";
import { RoutineNotFoundError } from "@/modules/routine";

describe("DELETE /api/routines/tasks/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.deleteTask.mockResolvedValue(undefined);
        mocks.getTask.mockResolvedValue({
            id: 71,
            canEdit: true,
            canDelete: false,
        });
        mocks.updateTask.mockResolvedValue({ id: 71 });
    });

    it("allows a current master assignee to fetch the task detail", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        const response = await GET(
            new NextRequest("http://localhost/api/routines/tasks/71"),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.getTask).toHaveBeenCalledWith(
            71,
            expect.objectContaining({
                actor: expect.objectContaining({ id: 5, role: "USER" }),
                employeeId: 21,
            }),
        );
    });

    it("passes an authorized assignee PATCH to the service with the authenticated actor", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: 3, title: "แก้ไขแล้ว" }),
            }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateTask).toHaveBeenCalledWith(
            71,
            { version: 3, title: "แก้ไขแล้ว" },
            expect.objectContaining({ id: 5, role: "USER" }),
        );
    });

    it("passes a direct PATCH carrying lifecycle input to the backend service", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    version: 3,
                    title: "แก้ไขได้",
                    isActive: false,
                }),
            }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateTask).toHaveBeenCalledWith(
            71,
            { version: 3, title: "แก้ไขได้", isActive: false },
            expect.objectContaining({ id: 5, role: "USER" }),
        );
    });

    it("returns the service denial for an unrelated employee instead of trusting UI capabilities", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 6, email: "other@example.com", role: "USER" },
            employeeId: 42,
        });
        mocks.updateTask.mockRejectedValueOnce(
            new RoutineNotFoundError("ไม่พบงานประจำ"),
        );

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: 3, title: "ไม่ควรแก้ได้" }),
            }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(404);
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
