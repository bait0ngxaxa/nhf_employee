import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { buildITTrendBuckets, formatITTrendRange } from "./analytics-trend";

const source = [
    { date: "2026-12-27", created: 2, resolved: 1 }, // Sunday, partial first week
    { date: "2026-12-28", created: 3, resolved: 2 },
    { date: "2027-01-03", created: 4, resolved: 1 }, // Same Monday-based week
    { date: "2027-01-04", created: 0, resolved: 2 }, // Partial final week
];

describe("IT trend display buckets", () => {
    it.each(["7D", "30D"] as const)("preserves every daily count for %s without mutating the source", (period) => {
        expect(buildITTrendBuckets(source, period)).toEqual(source.map(({ date, ...counts }) => ({
            startDate: date, endDate: date, ...counts,
        })));
        expect(source[0]).toEqual({ date: "2026-12-27", created: 2, resolved: 1 });
    });

    it("groups Monday through Sunday across month/year boundaries using only provided dates", () => {
        expect(buildITTrendBuckets([...source].reverse(), "90D")).toEqual([
            { startDate: "2026-12-27", endDate: "2026-12-27", created: 2, resolved: 1 },
            { startDate: "2026-12-28", endDate: "2027-01-03", created: 7, resolved: 3 },
            { startDate: "2027-01-04", endDate: "2027-01-04", created: 0, resolved: 2 },
        ]);
    });

    it.each(["7D", "30D", "90D"] as const)("preserves totals and backend-deduplicated resolution counts for %s", (period) => {
        const displayed = buildITTrendBuckets(source, period);
        for (const key of ["created", "resolved"] as const) {
            expect(displayed.reduce((sum, row) => sum + row[key], 0))
                .toBe(source.reduce((sum, row) => sum + row[key], 0));
        }
        // Counts are authoritative, including days with resolutions but no creations.
        expect(displayed.at(-1)?.resolved).toBe(2);
    });

    it.each(["7D", "30D", "90D"] as const)("handles empty and zero-filled %s periods", (period) => {
        expect(buildITTrendBuckets([], period)).toEqual([]);
        const zeros = source.map((row) => ({ ...row, created: 0, resolved: 0 }));
        expect(buildITTrendBuckets(zeros, period).every((row) => row.created === 0 && row.resolved === 0)).toBe(true);
    });

    it("labels actual partial ranges and Thai full dates", () => {
        const bucket = { startDate: "2026-10-14", endDate: "2026-10-18", created: 0, resolved: 0 };
        expect(formatITTrendRange(bucket, true)).toBe("14/10 – 18/10");
        expect(formatITTrendRange(bucket)).toBe("14 ตุลาคม 2569 – 18 ตุลาคม 2569");
        expect(formatITTrendRange({ ...bucket, endDate: bucket.startDate })).toBe("14 ตุลาคม 2569");
    });

    it("produces identical buckets in independent host timezones, including DST", () => {
        const script = `import { buildITTrendBuckets } from './modules/it/presentation/dashboard/analytics-trend.ts';
            process.stdout.write(JSON.stringify(buildITTrendBuckets(${JSON.stringify(source)}, '90D')));`;
        const results = ["UTC", "Asia/Bangkok", "America/Los_Angeles", "Pacific/Auckland"].map((TZ) =>
            execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
                env: { ...process.env, TZ }, encoding: "utf8",
            }),
        );
        expect(new Set(results).size).toBe(1);
        expect(JSON.parse(results[0] ?? "null")).toEqual(buildITTrendBuckets(source, "90D"));
    });
});
