import {
    IT_ANALYTICS_BACKLOG_AGE_BUCKETS,
    IT_TICKET_PRIORITY_LABELS,
    type ITAnalyticsBacklogAgeBucketKey,
    type ITAnalyticsDashboard,
} from "../../contracts";
import type { ITTicketPriority } from "@prisma/client";

/** Semantic tokens; each has a dark-theme value in `app/globals.css`. */
export const IT_ANALYTICS_PRIORITY_COLORS: Readonly<Record<ITTicketPriority, string>> = {
    P0: "var(--status-danger-solid)",
    P1: "var(--status-warning-solid)",
    P2: "var(--brand-foreground)",
    P3: "var(--content-muted)",
};

export const IT_ANALYTICS_BACKLOG_AGE_LABELS: Readonly<Record<ITAnalyticsBacklogAgeBucketKey, string>> =
    Object.fromEntries(
        IT_ANALYTICS_BACKLOG_AGE_BUCKETS.map((bucket) => [bucket.key, bucket.label]),
    ) as Record<ITAnalyticsBacklogAgeBucketKey, string>;

export const IT_ANALYTICS_WORKLOAD_LIMIT = 8;

export function formatITAnalyticsCount(count: number): string {
    return count.toLocaleString("th-TH");
}

/** One decimal place; a zero total is presented as 0%, never NaN. */
export function formatITAnalyticsShare(count: number, total: number): string {
    if (total <= 0) return "0%";
    return `${((count / total) * 100).toLocaleString("th-TH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    })}%`;
}

export interface ITAnalyticsPrioritySlice {
    readonly priority: ITTicketPriority;
    readonly label: string;
    readonly count: number;
    readonly share: string;
    readonly color: string;
}

export function buildITAnalyticsPrioritySlices(
    rows: ITAnalyticsDashboard["priorityBacklog"],
): { readonly total: number; readonly slices: readonly ITAnalyticsPrioritySlice[] } {
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return {
        total,
        slices: rows.map((row) => ({
            priority: row.priority,
            label: IT_TICKET_PRIORITY_LABELS[row.priority],
            count: row.count,
            share: formatITAnalyticsShare(row.count, total),
            color: IT_ANALYTICS_PRIORITY_COLORS[row.priority],
        })),
    };
}

export interface ITAnalyticsAgingRow {
    readonly bucket: ITAnalyticsBacklogAgeBucketKey;
    readonly label: string;
    readonly count: number;
}

export function buildITAnalyticsAgingRows(
    rows: ITAnalyticsDashboard["backlogAging"],
): readonly ITAnalyticsAgingRow[] {
    return rows.map((row) => ({
        bucket: row.bucket,
        label: IT_ANALYTICS_BACKLOG_AGE_LABELS[row.bucket],
        count: row.count,
    }));
}

/**
 * Keeps the server's deterministic ranking and collapses the tail into one
 * summarized row so no backlog Ticket disappears from the breakdown.
 */
export function buildITAnalyticsWorkloadRows(
    rows: ITAnalyticsDashboard["assigneeBacklog"],
    limit = IT_ANALYTICS_WORKLOAD_LIMIT,
): {
    readonly rows: ITAnalyticsDashboard["assigneeBacklog"];
    readonly otherPeople: number;
    readonly otherTickets: number;
} {
    if (rows.length <= limit) return { rows, otherPeople: 0, otherTickets: 0 };
    const tail = rows.slice(limit);
    return {
        rows: rows.slice(0, limit),
        otherPeople: tail.length,
        otherTickets: tail.reduce((sum, row) => sum + row.count, 0),
    };
}

const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("th", { granularity: "grapheme" })
    : null;

/**
 * Shortens chart axis labels by grapheme so Thai vowels and tone marks are
 * never split from their base consonant. Full names stay in the list/tooltip.
 */
export function truncateITAnalyticsLabel(label: string, maxLength: number): string {
    const characters = GRAPHEME_SEGMENTER
        ? Array.from(GRAPHEME_SEGMENTER.segment(label), (part) => part.segment)
        : Array.from(label);
    if (characters.length <= maxLength) return label;
    return `${characters.slice(0, Math.max(1, maxLength - 1)).join("").trimEnd()}…`;
}
