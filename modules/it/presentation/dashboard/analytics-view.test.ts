import { describe, expect, it } from "vitest";

import {
    buildITAnalyticsAgingRows,
    buildITAnalyticsPrioritySlices,
    buildITAnalyticsWorkloadRows,
    formatITAnalyticsShare,
    truncateITAnalyticsLabel,
} from "./analytics-view";

describe("IT analytics view helpers", () => {
    it("formats shares without NaN for an empty total", () => {
        expect(formatITAnalyticsShare(0, 0)).toBe("0%");
        expect(formatITAnalyticsShare(1, 3)).toBe("33.3%");
        expect(formatITAnalyticsShare(5, 5)).toBe("100%");
    });

    it("keeps every priority in canonical order with its share of the current backlog", () => {
        const result = buildITAnalyticsPrioritySlices([
            { priority: "P0", count: 1 },
            { priority: "P1", count: 0 },
            { priority: "P2", count: 3 },
            { priority: "P3", count: 0 },
        ]);

        expect(result.total).toBe(4);
        expect(result.slices.map((slice) => [slice.priority, slice.count, slice.share])).toEqual([
            ["P0", 1, "25%"],
            ["P1", 0, "0%"],
            ["P2", 3, "75%"],
            ["P3", 0, "0%"],
        ]);
        expect(result.slices[0]?.label).toBe("P0 — วิกฤต");
    });

    it("labels aging buckets in Thai", () => {
        expect(buildITAnalyticsAgingRows([
            { bucket: "0_1", count: 1 },
            { bucket: "15_PLUS", count: 2 },
        ])).toEqual([
            { bucket: "0_1", label: "0–1 วัน", count: 1 },
            { bucket: "15_PLUS", label: "15 วันขึ้นไป", count: 2 },
        ]);
    });

    it("summarizes the workload tail instead of dropping backlog", () => {
        const rows = Array.from({ length: 10 }, (_, index) => ({ label: `คน ${index}`, count: 10 - index }));
        const result = buildITAnalyticsWorkloadRows(rows, 8);

        expect(result.rows).toHaveLength(8);
        expect(result.otherPeople).toBe(2);
        expect(result.otherTickets).toBe(2 + 1);
        expect(buildITAnalyticsWorkloadRows(rows.slice(0, 3), 8)).toEqual({
            rows: rows.slice(0, 3),
            otherPeople: 0,
            otherTickets: 0,
        });
    });

    it("truncates Thai labels by grapheme without detaching vowels or tone marks", () => {
        expect(truncateITAnalyticsLabel("เครื่องพิมพ์", 20)).toBe("เครื่องพิมพ์");
        const truncated = truncateITAnalyticsLabel("อุปกรณ์คอมพิวเตอร์", 6);
        expect(truncated.endsWith("…")).toBe(true);
        expect(truncated).toBe("อุปกรณ์…");
    });
});
