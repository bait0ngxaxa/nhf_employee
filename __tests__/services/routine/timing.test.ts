import { describe, expect, it } from "vitest";

import { getCurrentBangkokDate } from "@/lib/routine/schedule";
import {
    getRoutineTimingStatus,
} from "@/lib/routine/timing";

describe("Routine timing status", () => {
    const today = "2026-08-04";

    it.each([
        ["yesterday", "2026-08-03", "OVERDUE"],
        ["today", "2026-08-04", "DUE_TODAY"],
        ["tomorrow", "2026-08-05", "DUE_SOON"],
        ["seven days", "2026-08-11", "DUE_SOON"],
        ["eight days", "2026-08-12", "UPCOMING"],
    ])("classifies %s", (_label, dueDate, expected) => {
        expect(getRoutineTimingStatus(today, dueDate)).toBe(expected);
    });

    it("uses the Bangkok calendar day at the UTC boundary", () => {
        const bangkokDate = getCurrentBangkokDate(
            new Date("2026-08-03T17:00:00.000Z"),
        );

        expect(bangkokDate).toBe("2026-08-04");
        expect(getRoutineTimingStatus(bangkokDate, "2026-08-04")).toBe("DUE_TODAY");
    });
});
