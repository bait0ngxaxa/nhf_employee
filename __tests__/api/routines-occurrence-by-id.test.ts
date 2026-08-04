import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    getOccurrence: vi.fn(),
    updateOverride: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/services/routine", () => ({
    getRoutineOccurrenceById: mocks.getOccurrence,
    updateRoutineOccurrenceOverride: mocks.updateOverride,
}));

import { PATCH } from "@/app/api/routines/occurrences/[id]/route";

describe("PATCH /api/routines/occurrences/:id", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
            ok: true,
            user: { id: 99, email: "admin@example.com", role: "ADMIN" },
        });
        mocks.updateOverride.mockResolvedValue(undefined);
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

    it("does not mutate when the caller is not an admin", async () => {
        mocks.requireAdminSession.mockResolvedValue({
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
});
