import { describe, expect, it } from "vitest";

import { resolveRoutineTaskCapabilities } from "./capabilities";

function assignee(
    employeeId: number,
    employee: { status: string; deletedAt: Date | null } | null = {
        status: "ACTIVE",
        deletedAt: null,
    },
) {
    return { employeeId, employee };
}

describe("Routine task capabilities", () => {
    it("allows broad authority to edit every task", () => {
        expect(resolveRoutineTaskCapabilities(
            { createdById: 7, assignees: [] },
            { actorId: 99, employeeId: null, hasBroadAuthority: true },
        )).toMatchObject({ canEdit: true, canDelete: true });
    });

    it("allows the creator to edit their task", () => {
        expect(resolveRoutineTaskCapabilities(
            { createdById: 7, assignees: [] },
            { actorId: 7, employeeId: null, hasBroadAuthority: false },
        )).toMatchObject({ canEdit: true, canDelete: true });
    });

    it("allows the current active assignee to edit without delete access", () => {
        expect(resolveRoutineTaskCapabilities(
            { createdById: 7, assignees: [assignee(21)] },
            { actorId: 99, employeeId: 21, hasBroadAuthority: false },
        )).toMatchObject({ canEdit: true, canDelete: false });
    });

    it("does not allow an unrelated employee to edit", () => {
        expect(resolveRoutineTaskCapabilities(
            { createdById: 7, assignees: [assignee(21)] },
            { actorId: 99, employeeId: 42, hasBroadAuthority: false },
        )).toMatchObject({ canEdit: false, canDelete: false });
    });

    it.each([
        [{ status: "INACTIVE", deletedAt: null }],
        [{ status: "ACTIVE", deletedAt: new Date("2026-01-01T00:00:00.000Z") }],
        [null],
    ])("does not allow an inactive or deleted assignee to edit", (employee) => {
        expect(resolveRoutineTaskCapabilities(
            { createdById: 7, assignees: [assignee(21, employee)] },
            { actorId: 99, employeeId: 21, hasBroadAuthority: false },
        ).canEdit).toBe(false);
    });
});
