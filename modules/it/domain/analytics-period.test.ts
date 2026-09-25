import { describe, expect, it } from "vitest";

import { getITAnalyticsLocalDate, getITAnalyticsPeriodBounds } from "./analytics-period";

describe("IT analytics reporting periods", () => {
    const now = new Date("2026-09-25T17:05:00.000Z");

    it.each([
        ["7D", 7, "2026-09-19T17:00:00.000Z", "2026-09-20"],
        ["30D", 30, "2026-08-27T17:00:00.000Z", "2026-08-28"],
        ["90D", 90, "2026-06-28T17:00:00.000Z", "2026-06-29"],
    ] as const)("builds %s from Bangkok calendar days", (key, days, startAt, firstDate) => {
        const bounds = getITAnalyticsPeriodBounds(key, now);

        expect(bounds.startAt.toISOString()).toBe(startAt);
        expect(bounds.endAt.toISOString()).toBe(now.toISOString());
        expect(bounds.dates).toHaveLength(days);
        expect(bounds.dates[0]).toBe(firstDate);
        expect(bounds.dates.at(-1)).toBe("2026-09-26");
        expect(bounds.key).toBe(key);
    });

    it("assigns timestamps around Bangkok midnight to the correct day", () => {
        expect(getITAnalyticsLocalDate(new Date("2026-09-25T16:59:59.999Z")))
            .toBe("2026-09-25");
        expect(getITAnalyticsLocalDate(new Date("2026-09-25T17:00:00.000Z")))
            .toBe("2026-09-26");
    });

    it("rejects an invalid injected clock", () => {
        expect(() => getITAnalyticsPeriodBounds("30D", new Date(Number.NaN)))
            .toThrow(RangeError);
    });
});
