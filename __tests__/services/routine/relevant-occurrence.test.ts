import { describe, expect, it } from "vitest";

import {
    resolveRelevantRoutineOccurrence,
    resolveRelevantRoutineOccurrences,
} from "@/lib/services/routine/relevant-occurrence";

const today = "2026-08-04";

function occurrence(
    id: number,
    taskId: number,
    dueDate: string,
) {
    return { id, taskId, dueDate, periodKey: `${taskId}-${id}` };
}

describe("Routine relevant occurrence resolver", () => {
    it("returns one task row's relevant occurrence from multiple rounds", () => {
        const result = resolveRelevantRoutineOccurrence(
            [
                occurrence(1, 71, "2026-01-10"),
                occurrence(2, 71, "2026-08-10"),
                occurrence(3, 71, "2026-09-10"),
            ],
            today,
        );

        expect(result?.id).toBe(2);
    });

    it("chooses the nearest future occurrence instead of the oldest past one", () => {
        const result = resolveRelevantRoutineOccurrence(
            [
                occurrence(1, 71, "2026-01-10"),
                occurrence(2, 71, "2026-08-20"),
                occurrence(3, 71, "2026-08-10"),
            ],
            today,
        );

        expect(result?.id).toBe(3);
    });

    it("prefers an occurrence due today", () => {
        const result = resolveRelevantRoutineOccurrence(
            [
                occurrence(1, 71, "2026-08-05"),
                occurrence(2, 71, today),
                occurrence(3, 71, "2026-09-05"),
            ],
            today,
        );

        expect(result?.id).toBe(2);
    });

    it("falls back to the latest historical occurrence with a descending id tie-break", () => {
        const result = resolveRelevantRoutineOccurrence(
            [
                occurrence(1, 71, "2026-08-01"),
                occurrence(4, 71, "2026-08-03"),
                occurrence(5, 71, "2026-08-03"),
            ],
            today,
        );

        expect(result?.id).toBe(5);
    });

    it("returns null when a task has no occurrence", () => {
        expect(resolveRelevantRoutineOccurrence([], today)).toBeNull();
    });

    it("resolves one occurrence per task and honors notification focus", () => {
        const result = resolveRelevantRoutineOccurrences(
            [
                occurrence(1, 71, "2026-08-10"),
                occurrence(2, 71, "2026-08-20"),
                occurrence(3, 72, "2026-08-11"),
                occurrence(4, 72, "2026-08-12"),
            ],
            today,
            2,
        );

        expect([...result.keys()]).toEqual([71, 72]);
        expect(result.get(71)?.id).toBe(2);
        expect(result.get(72)?.id).toBe(3);
    });
});
