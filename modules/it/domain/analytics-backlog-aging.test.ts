import { describe, expect, it } from "vitest";

import { IT_ANALYTICS_BACKLOG_AGE_BUCKETS } from "../contracts";
import {
    getITBacklogAgeBucket,
    getITBacklogAgeBucketBounds,
    getITBacklogAgeCompletedDays,
    IT_ANALYTICS_DAY_MS,
} from "./analytics-backlog-aging";

const now = new Date("2026-09-25T17:05:00.000Z");

function createdAgo(milliseconds: number): Date {
    return new Date(now.getTime() - milliseconds);
}

/** Mirrors the SQL predicate the repository builds from each bound. */
function bucketByBounds(createdAt: Date): string[] {
    return getITBacklogAgeBucketBounds(now)
        .filter((bounds) =>
            (bounds.createdAtLte === null || createdAt.getTime() <= bounds.createdAtLte.getTime())
            && (bounds.createdAtGt === null || createdAt.getTime() > bounds.createdAtGt.getTime()))
        .map((bounds) => bounds.key);
}

describe("IT backlog aging", () => {
    it("counts completed elapsed 24-hour periods and clamps future timestamps to zero", () => {
        expect(getITBacklogAgeCompletedDays(createdAgo(0), now)).toBe(0);
        expect(getITBacklogAgeCompletedDays(createdAgo(IT_ANALYTICS_DAY_MS - 1), now)).toBe(0);
        expect(getITBacklogAgeCompletedDays(createdAgo(IT_ANALYTICS_DAY_MS), now)).toBe(1);
        expect(getITBacklogAgeCompletedDays(createdAgo(8 * IT_ANALYTICS_DAY_MS - 1), now)).toBe(7);
        expect(getITBacklogAgeCompletedDays(createdAgo(8 * IT_ANALYTICS_DAY_MS), now)).toBe(8);
        expect(getITBacklogAgeCompletedDays(new Date(now.getTime() + 60_000), now)).toBe(0);
    });

    it.each([
        [0, "0_1"],
        [1, "0_1"],
        [2, "2_3"],
        [3, "2_3"],
        [4, "4_7"],
        [7, "4_7"],
        [8, "8_14"],
        [14, "8_14"],
        [15, "15_PLUS"],
        [400, "15_PLUS"],
        [-3, "0_1"],
    ] as const)("places %i completed days in %s", (days, bucket) => {
        expect(getITBacklogAgeBucket(days)).toBe(bucket);
    });

    it("defines contiguous, exhaustive buckets from zero", () => {
        const [first, ...rest] = IT_ANALYTICS_BACKLOG_AGE_BUCKETS;
        expect(first.minDays).toBe(0);
        let previousMax: number | null = first.maxDays;
        for (const bucket of rest) {
            expect(previousMax).not.toBeNull();
            expect(bucket.minDays).toBe((previousMax ?? 0) + 1);
            previousMax = bucket.maxDays;
        }
        expect(previousMax).toBeNull();
    });

    it("builds createdAt bounds from one captured instant", () => {
        expect(getITBacklogAgeBucketBounds(now)).toEqual([
            { key: "0_1", createdAtLte: null, createdAtGt: createdAgo(2 * IT_ANALYTICS_DAY_MS) },
            {
                key: "2_3",
                createdAtLte: createdAgo(2 * IT_ANALYTICS_DAY_MS),
                createdAtGt: createdAgo(4 * IT_ANALYTICS_DAY_MS),
            },
            {
                key: "4_7",
                createdAtLte: createdAgo(4 * IT_ANALYTICS_DAY_MS),
                createdAtGt: createdAgo(8 * IT_ANALYTICS_DAY_MS),
            },
            {
                key: "8_14",
                createdAtLte: createdAgo(8 * IT_ANALYTICS_DAY_MS),
                createdAtGt: createdAgo(15 * IT_ANALYTICS_DAY_MS),
            },
            { key: "15_PLUS", createdAtLte: createdAgo(15 * IT_ANALYTICS_DAY_MS), createdAtGt: null },
        ]);
    });

    it.each([
        0,
        1,
        IT_ANALYTICS_DAY_MS - 1,
        2 * IT_ANALYTICS_DAY_MS - 1,
        2 * IT_ANALYTICS_DAY_MS,
        4 * IT_ANALYTICS_DAY_MS - 1,
        4 * IT_ANALYTICS_DAY_MS,
        8 * IT_ANALYTICS_DAY_MS - 1,
        8 * IT_ANALYTICS_DAY_MS,
        15 * IT_ANALYTICS_DAY_MS - 1,
        15 * IT_ANALYTICS_DAY_MS,
        200 * IT_ANALYTICS_DAY_MS,
        -IT_ANALYTICS_DAY_MS,
    ])("assigns age %i ms to exactly the bucket of its completed days", (elapsed) => {
        const createdAt = createdAgo(elapsed);
        expect(bucketByBounds(createdAt)).toEqual([
            getITBacklogAgeBucket(getITBacklogAgeCompletedDays(createdAt, now)),
        ]);
    });

    it("rejects an invalid clock", () => {
        expect(() => getITBacklogAgeBucketBounds(new Date(Number.NaN))).toThrow(RangeError);
        expect(() => getITBacklogAgeCompletedDays(new Date(Number.NaN), now)).toThrow(RangeError);
    });
});
