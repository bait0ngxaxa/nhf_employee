import {
    IT_ANALYTICS_BACKLOG_AGE_BUCKETS,
    type ITAnalyticsBacklogAgeBucketKey,
} from "../contracts";

export const IT_ANALYTICS_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Inclusive/exclusive `createdAt` bounds for one aging bucket at a captured
 * reporting instant. A null bound is open-ended.
 */
export interface ITBacklogAgeBucketBounds {
    readonly key: ITAnalyticsBacklogAgeBucketKey;
    /** Ticket `createdAt <= createdAtLte` (at least `minDays` completed days). */
    readonly createdAtLte: Date | null;
    /** Ticket `createdAt > createdAtGt` (at most `maxDays` completed days). */
    readonly createdAtGt: Date | null;
}

function assertValidInstant(date: Date, name: string): void {
    if (!Number.isFinite(date.getTime())) {
        throw new RangeError(`${name} must be a valid date`);
    }
}

/**
 * Completed elapsed 24-hour periods since creation. A future `createdAt`
 * (clock skew or inconsistent data) clamps to zero instead of going negative.
 */
export function getITBacklogAgeCompletedDays(createdAt: Date, now: Date): number {
    assertValidInstant(createdAt, "createdAt");
    assertValidInstant(now, "now");
    return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / IT_ANALYTICS_DAY_MS));
}

export function getITBacklogAgeBucket(completedDays: number): ITAnalyticsBacklogAgeBucketKey {
    const days = Math.max(0, Math.floor(completedDays));
    const bucket = IT_ANALYTICS_BACKLOG_AGE_BUCKETS.find((candidate) =>
        days >= candidate.minDays && (candidate.maxDays === null || days <= candidate.maxDays));
    // The bucket list is contiguous from zero and open-ended, so this is unreachable.
    return bucket?.key ?? "15_PLUS";
}

/**
 * Translates the bucket definitions into `createdAt` predicates for one
 * captured `now`, so every bucket in a response shares the same instant and
 * the database can count each range on the `(status, createdAt)` index.
 */
export function getITBacklogAgeBucketBounds(now: Date): readonly ITBacklogAgeBucketBounds[] {
    assertValidInstant(now, "now");
    const nowMs = now.getTime();
    return IT_ANALYTICS_BACKLOG_AGE_BUCKETS.map((bucket) => ({
        key: bucket.key,
        createdAtLte: bucket.minDays === 0
            ? null
            : new Date(nowMs - bucket.minDays * IT_ANALYTICS_DAY_MS),
        createdAtGt: bucket.maxDays === null
            ? null
            : new Date(nowMs - (bucket.maxDays + 1) * IT_ANALYTICS_DAY_MS),
    }));
}
