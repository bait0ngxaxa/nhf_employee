import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    getOccurrence: vi.fn(),
    updateDueDate: vi.fn(),
    reassign: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/modules/routine", async (importOriginal) => ({
    ...(await importOriginal()),
    getRoutineOccurrenceById: mocks.getOccurrence,
    updateRoutineOccurrenceDueDate: mocks.updateDueDate,
    reassignRoutineOccurrence: mocks.reassign,
}));

import { PATCH as patchAssignees } from "@/app/api/routines/occurrences/[id]/assignees/route";
import { PATCH as patchDueDate } from "@/app/api/routines/occurrences/[id]/due-date/route";

describe("legacy Routine occurrence mutation routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.getOccurrence.mockResolvedValue({ occurrence: { id: 91 } });
        mocks.updateDueDate.mockResolvedValue(undefined);
        mocks.reassign.mockResolvedValue(undefined);
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
});
