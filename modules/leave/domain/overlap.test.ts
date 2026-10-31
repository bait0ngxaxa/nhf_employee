import { describe, expect, it } from "vitest";

import { doLeaveRequestsOverlap, type LeavePeriodValue } from "./utils";

const periods: LeavePeriodValue[] = ["FULL_DAY", "MORNING", "AFTERNOON"];
const day = { startDate: "2031-05-12", endDate: "2031-05-12" };

describe("leave request overlap", () => {
    it.each([
        ["MORNING", "AFTERNOON", false],
        ["AFTERNOON", "MORNING", false],
        ["MORNING", "MORNING", true],
        ["AFTERNOON", "AFTERNOON", true],
        ["FULL_DAY", "MORNING", true],
        ["FULL_DAY", "AFTERNOON", true],
        ["MORNING", "FULL_DAY", true],
        ["AFTERNOON", "FULL_DAY", true],
        ["FULL_DAY", "FULL_DAY", true],
    ] as const)("%s versus %s conflicts: %s", (existing, requested, conflicts) => {
        expect(doLeaveRequestsOverlap(
            { ...day, period: existing },
            { ...day, period: requested },
        )).toBe(conflicts);
    });

    it.each(["2031-05-12", "2031-05-13", "2031-05-14"])(
        "includes the multi-day range boundary/interior %s in both directions",
        (date) => {
            const full = { ...day, endDate: "2031-05-14", period: "FULL_DAY" } as const;
            const half = { startDate: date, endDate: date, period: "MORNING" } as const;
            expect(doLeaveRequestsOverlap(full, half)).toBe(true);
            expect(doLeaveRequestsOverlap(half, full)).toBe(true);
        },
    );

    it("allows disjoint dates in both directions, including full days", () => {
        for (const period of periods) {
            const existing = { ...day, period };
            const later = { startDate: "2031-05-13", endDate: "2031-05-13", period: "FULL_DAY" } as const;
            expect(doLeaveRequestsOverlap(existing, later)).toBe(false);
            expect(doLeaveRequestsOverlap(later, existing)).toBe(false);
        }
    });

    it("compares calendar dates in the business timezone", () => {
        expect(doLeaveRequestsOverlap(
            { ...day, period: "FULL_DAY" },
            {
                startDate: new Date("2031-05-11T18:00:00Z"),
                endDate: new Date("2031-05-11T18:00:00Z"),
                period: "MORNING",
            },
        )).toBe(true);
    });
});
