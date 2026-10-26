import { IT_ANALYTICS_TIME_ZONE, type ITAnalyticsDashboard, type ITAnalyticsPeriod } from "../../contracts";

export interface ITTrendBucket {
    readonly startDate: string;
    readonly endDate: string;
    readonly created: number;
    readonly resolved: number;
}

/** API dates already represent Bangkok calendar days, not instants to re-zone. */
export function buildITTrendBuckets(
    trend: ITAnalyticsDashboard["trend"],
    period: ITAnalyticsPeriod,
): ITTrendBucket[] {
    if (period !== "90D") {
        return trend.map(({ date, created, resolved }) => ({ startDate: date, endDate: date, created, resolved }));
    }

    const weeks = new Map<string, ITTrendBucket>();
    for (const row of [...trend].sort((a, b) => a.date.localeCompare(b.date))) {
        // UTC arithmetic on date-only values avoids dependence on the host timezone/DST.
        const monday = new Date(`${row.date}T00:00:00Z`);
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        const key = monday.toISOString().slice(0, 10);
        const previous = weeks.get(key);
        weeks.set(key, {
            startDate: previous?.startDate ?? row.date,
            endDate: row.date,
            created: (previous?.created ?? 0) + row.created,
            resolved: (previous?.resolved ?? 0) + row.resolved,
        });
    }
    return [...weeks.values()];
}

export function formatITTrendDate(date: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: IT_ANALYTICS_TIME_ZONE,
        dateStyle: "long",
    }).format(new Date(`${date}T00:00:00+07:00`));
}

export function formatITTrendRange(bucket: ITTrendBucket, compact = false): string {
    const format = compact
        ? (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`
        : formatITTrendDate;
    const start = format(bucket.startDate);
    return bucket.startDate === bucket.endDate ? start : `${start} – ${format(bucket.endDate)}`;
}
