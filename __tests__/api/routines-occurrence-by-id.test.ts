import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    RoutineConflictError,
    RoutineForbiddenError,
} from "@/modules/routine";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
    assertRoutineCapabilityForMigration: vi.fn(),
    getOccurrence: vi.fn(),
    updateOverride: vi.fn(),
}));

const committedOccurrence = {
    id: 91,
    taskId: 71,
    periodKey: "2026-08",
    dueDate: new Date("2026-08-10T00:00:00.000Z"),
    originalDueDate: new Date("2026-08-09T00:00:00.000Z"),
    isDueDateOverridden: true,
    scheduleVersion: 1,
    reminderVersion: 5,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    task: {
        id: 71,
        title: "งานประจำ",
        description: null,
        scheduleType: "MONTHLY",
        scheduleText: null,
        isActive: true,
        unit: { id: 1, code: "OPS", name: "ปฏิบัติการ" },
        category: { id: 2, name: "ทั่วไป" },
    },
    assignees: [{
        employeeId: 42,
        role: "OWNER",
        employee: {
            id: 42,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            status: "ACTIVE",
            deletedAt: null,
        },
    }],
};

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession: mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/modules/routine", async (importOriginal) => ({
    ...(await importOriginal()),
    assertRoutineCapabilityForMigration: mocks.assertRoutineCapabilityForMigration,
    getRoutineOccurrenceById: mocks.getOccurrence,
    updateRoutineOccurrenceOverride: mocks.updateOverride,
}));

import { PATCH } from "@/app/api/routines/occurrences/[id]/route";

describe("PATCH /api/routines/occurrences/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.assertRoutineCapabilityForMigration.mockResolvedValue(undefined);
        mocks.updateOverride.mockResolvedValue(committedOccurrence);
        mocks.getOccurrence.mockResolvedValue({ occurrence: { id: 91 } });
    });

    it("updates due date and assignees through one atomic service call", async () => {
        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/occurrences/91", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 4,
                    dueDate: "2026-08-10",
                    note: "เลื่อนตามการประชุม",
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateOverride).toHaveBeenCalledWith(
            91,
            {
                expectedReminderVersion: 4,
                dueDate: "2026-08-10",
                note: "เลื่อนตามการประชุม",
                assignees: [{ employeeId: 21, role: "OWNER" }],
            },
            expect.objectContaining({ id: 99, role: "ADMIN" }),
        );
    });

    it("returns the committed mutation result without requiring occurrence read access", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });
        mocks.getOccurrence.mockResolvedValue(null);
        mocks.updateOverride.mockResolvedValue(committedOccurrence);

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/occurrences/91", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 4,
                    dueDate: "2026-08-10",
                    assignees: [{ employeeId: 42, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.assertRoutineCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({ id: 5, role: "USER" }),
            21,
            "routine.occurrence.override",
        );
        expect(mocks.getOccurrence).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body).toEqual(expect.objectContaining({
            occurrence: expect.objectContaining({
                id: 91,
                dueDate: expect.any(String),
            }),
        }));
        expect(body.occurrence).not.toHaveProperty("isDueDateOverridden");
        expect(body.occurrence.task).not.toHaveProperty("isActive");
    });

    it("does not mutate when the caller is not an admin", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 }),
        });

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/occurrences/91", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    dueDate: "2026-08-10",
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(403);
        expect(mocks.updateOverride).not.toHaveBeenCalled();
    });

    it("keeps capability denial ahead of legacy input parsing", async () => {
        mocks.assertRoutineCapabilityForMigration.mockRejectedValue(
            new RoutineForbiddenError(),
        );

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/occurrences/91", {
                method: "PATCH",
            }),
            { params: Promise.resolve({ id: "not-a-number" }) },
        );

        expect(response.status).toBe(403);
        expect(mocks.updateOverride).not.toHaveBeenCalled();
        expect(mocks.assertRoutineCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({ id: 99, role: "ADMIN" }),
            null,
            "routine.occurrence.override",
        );
    });

    it("rejects an atomic override without an expected reminder version", async () => {
        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/occurrences/91", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    dueDate: "2026-08-10",
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(400);
        expect(mocks.updateOverride).not.toHaveBeenCalled();
    });

    it("returns 409 when the atomic override version is stale", async () => {
        mocks.updateOverride.mockRejectedValue(
            new RoutineConflictError("ข้อมูลรอบนี้เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่"),
        );

        const response = await PATCH(
            new NextRequest("http://localhost/api/routines/occurrences/91", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 3,
                    dueDate: "2026-08-10",
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(409);
    });
});
