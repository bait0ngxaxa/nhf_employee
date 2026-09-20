import { describe, expect, it } from "vitest";

import {
    normalizeRoutineReminderRecipientScope,
    normalizeRoutineReminderRules,
} from "./recipient-scope-compatibility";

describe("Routine reminder recipient scope compatibility", () => {
    it.each([
        ["ADMINS", "ALL_READERS"],
        ["ASSIGNEES_AND_ADMINS", "ASSIGNEES_AND_ALL_READERS"],
        ["ASSIGNEES", "ASSIGNEES"],
        ["ALL_READERS", "ALL_READERS"],
        ["ASSIGNEES_AND_ALL_READERS", "ASSIGNEES_AND_ALL_READERS"],
    ] as const)("normalizes %s to %s", (persisted, canonical) => {
        expect(normalizeRoutineReminderRecipientScope(persisted)).toBe(canonical);
    });

    it("normalizes persisted rules without producing legacy values", () => {
        expect(normalizeRoutineReminderRules([
            {
                daysBefore: 3,
                recipientScope: "ADMINS",
                isActive: true,
            },
            {
                daysBefore: 1,
                recipientScope: "ASSIGNEES_AND_ADMINS",
                isActive: true,
            },
        ])).toEqual([
            {
                daysBefore: 3,
                recipientScope: "ALL_READERS",
                isActive: true,
            },
            {
                daysBefore: 1,
                recipientScope: "ASSIGNEES_AND_ALL_READERS",
                isActive: true,
            },
        ]);
    });
});
