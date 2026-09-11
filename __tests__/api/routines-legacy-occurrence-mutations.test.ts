import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireActiveWorkforceOrAdminSession: vi.fn(),
    assertRoutineCapabilityForMigration: vi.fn(),
    getOccurrence: vi.fn(),
    updateDueDate: vi.fn(),
    reassign: vi.fn(),
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
    updateRoutineOccurrenceDueDate: mocks.updateDueDate,
    reassignRoutineOccurrence: mocks.reassign,
}));

import { PATCH as patchAssignees } from "@/app/api/routines/occurrences/[id]/assignees/route";
import { PATCH as patchDueDate } from "@/app/api/routines/occurrences/[id]/due-date/route";

describe("legacy Routine occurrence mutation routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.assertRoutineCapabilityForMigration.mockResolvedValue(undefined);
        mocks.getOccurrence.mockResolvedValue({ occurrence: { id: 91 } });
        mocks.updateDueDate.mockResolvedValue(committedOccurrence);
        mocks.reassign.mockResolvedValue(committedOccurrence);
    });

    it("rejects a legacy due-date mutation without an expected version", async () => {
        const response = await patchDueDate(
            new NextRequest("http://localhost/api/routines/occurrences/91/due-date", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dueDate: "2026-08-10" }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(400);
        expect(mocks.updateDueDate).not.toHaveBeenCalled();
    });

    it("rejects a legacy assignee mutation without an expected version", async () => {
        const response = await patchAssignees(
            new NextRequest("http://localhost/api/routines/occurrences/91/assignees", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(400);
        expect(mocks.reassign).not.toHaveBeenCalled();
    });

    it("passes the expected version through both retained legacy routes", async () => {
        const dueDateResponse = await patchDueDate(
            new NextRequest("http://localhost/api/routines/occurrences/91/due-date", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 4,
                    dueDate: "2026-08-10",
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );
        const assigneeResponse = await patchAssignees(
            new NextRequest("http://localhost/api/routines/occurrences/91/assignees", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 4,
                    assignees: [{ employeeId: 21, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(dueDateResponse.status).toBe(200);
        expect(assigneeResponse.status).toBe(200);
        expect(mocks.updateDueDate).toHaveBeenCalledWith(
            91,
            { expectedReminderVersion: 4, dueDate: "2026-08-10" },
            expect.objectContaining({ id: 99, role: "ADMIN" }),
        );
        expect(mocks.reassign).toHaveBeenCalledWith(
            91,
            {
                expectedReminderVersion: 4,
                assignees: [{ employeeId: 21, role: "OWNER" }],
            },
            expect.objectContaining({ id: 99, role: "ADMIN" }),
        );
    });

    it("returns the committed due-date mutation without requiring occurrence read access", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });
        mocks.getOccurrence.mockResolvedValue(null);
        mocks.updateDueDate.mockResolvedValue(committedOccurrence);

        const response = await patchDueDate(
            new NextRequest("http://localhost/api/routines/occurrences/91/due-date", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 4,
                    dueDate: "2026-08-10",
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.assertRoutineCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({ id: 5, role: "USER" }),
            21,
            "routine.occurrence.change_due_date",
        );
        expect(mocks.getOccurrence).not.toHaveBeenCalled();
        expect(await response.json()).toEqual(expect.objectContaining({
            occurrence: expect.objectContaining({ id: 91 }),
        }));
    });

    it("returns the committed reassignment without requiring occurrence read access", async () => {
        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 5, email: "user@example.com", role: "USER" },
            employeeId: 21,
        });
        mocks.getOccurrence.mockResolvedValue(null);
        mocks.reassign.mockResolvedValue(committedOccurrence);

        const response = await patchAssignees(
            new NextRequest("http://localhost/api/routines/occurrences/91/assignees", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 4,
                    assignees: [{ employeeId: 42, role: "OWNER" }],
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.assertRoutineCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({ id: 5, role: "USER" }),
            21,
            "routine.occurrence.reassign",
        );
        expect(mocks.getOccurrence).not.toHaveBeenCalled();
        expect(await response.json()).toEqual(expect.objectContaining({
            occurrence: expect.objectContaining({ id: 91 }),
        }));
    });
});
