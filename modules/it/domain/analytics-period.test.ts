import { describe, expect, it } from "vitest";

import { getITAnalyticsLocalDate, getITAnalyticsPeriodBounds } from "./analytics-period";

describe("IT analytics reporting periods", () => {
    const now = new Date("2026-09-25T17:05:00.000Z");

    it.each([
        ["7D", 7, "2026-09-19T17:00:00.000Z", "2026-09-20", "2026-09-13T16:55:00.000Z"],
        ["30D", 30, "2026-08-27T17:00:00.000Z", "2026-08-28", "2026-07-29T16:55:00.000Z"],
        ["90D", 90, "2026-06-28T17:00:00.000Z", "2026-06-29", "2026-03-31T16:55:00.000Z"],
    ] as const)("builds %s and its adjacent equal-length Bangkok comparison", (key, days, startAt, firstDate, previousStartAt) => {
        const bounds = getITAnalyticsPeriodBounds(key, now);

        expect(bounds.startAt.toISOString()).toBe(startAt);
        expect(bounds.endAt.toISOString()).toBe(now.toISOString());
        expect(bounds.previous.startAt.toISOString()).toBe(previousStartAt);
        expect(bounds.previous.endAt).toEqual(bounds.startAt);
        expect(+bounds.previous.endAt - +bounds.previous.startAt).toBe(+bounds.endAt - +bounds.startAt);
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

    it("advances the reporting window exactly at Bangkok midnight across the year boundary", () => {
        const midnight = new Date("2026-12-31T17:00:00.000Z");
        const before = getITAnalyticsPeriodBounds("7D", new Date(+midnight - 1));
        const after = getITAnalyticsPeriodBounds("7D", midnight);
        expect(before.startAt.toISOString()).toBe("2026-12-24T17:00:00.000Z");
        expect(after.startAt.toISOString()).toBe("2026-12-25T17:00:00.000Z");
        expect(after.endAt).toEqual(midnight);
        expect(after.previous.startAt.toISOString()).toBe("2026-12-19T17:00:00.000Z");
        expect(after.previous.endAt).toEqual(after.startAt);
        expect(after.dates.at(-1)).toBe("2027-01-01");
    });
});
