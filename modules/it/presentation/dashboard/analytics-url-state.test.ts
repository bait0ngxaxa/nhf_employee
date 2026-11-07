import { describe, expect, it } from "vitest";

import {
    buildITAnalyticsQueueDestinations,
    IT_ANALYTICS_DEFAULT_REPORT_STATE,
    isDefaultITAnalyticsReportState,
    parseITAnalyticsUrlState,
    toITAnalyticsApiQuery,
    writeITAnalyticsUrlState,
} from "./analytics-url-state";
import { parseITOperatorQueueUrlFilters } from "./operator-queue-url";

function params(query: string): URLSearchParams {
    return new URL(query, "http://localhost").searchParams;
}

describe("IT analytics report URL state", () => {
    it("defaults to 30 days with no Ticket filters", () => {
        expect(parseITAnalyticsUrlState(params("/dashboard/it?itTab=analytics")))
            .toEqual(IT_ANALYTICS_DEFAULT_REPORT_STATE);
        expect(isDefaultITAnalyticsReportState(IT_ANALYTICS_DEFAULT_REPORT_STATE)).toBe(true);
    });

    it("parses valid report filters and ignores malformed values", () => {
        expect(parseITAnalyticsUrlState(params("/?reportPeriod=90D&reportType=SUGGESTION&reportCategory=7")))
            .toEqual({ period: "90D", type: "SUGGESTION", category: 7 });
        expect(parseITAnalyticsUrlState(params("/?reportCategory=uncategorized")))
            .toEqual({ period: "30D", type: null, category: "uncategorized" });
        expect(parseITAnalyticsUrlState(params(
            "/?reportPeriod=365D&reportType=incident&reportCategory=abc",
        ))).toEqual(IT_ANALYTICS_DEFAULT_REPORT_STATE);
    });

    it("writes only non-default report keys and preserves unrelated workspace keys", () => {
        const current = params("/?itTab=analytics&reportType=INCIDENT&queuePriority=P0");
        const filtered = writeITAnalyticsUrlState(current, {
            period: "7D",
            type: null,
            category: "uncategorized",
        });

        expect(filtered.toString())
            .toBe("itTab=analytics&queuePriority=P0&reportPeriod=7D&reportCategory=uncategorized");
        expect(writeITAnalyticsUrlState(filtered, IT_ANALYTICS_DEFAULT_REPORT_STATE).toString())
            .toBe("itTab=analytics&queuePriority=P0");
        expect(current.toString()).toBe("itTab=analytics&reportType=INCIDENT&queuePriority=P0");
    });

    it("sends only the analytics API's supported parameters", () => {
        expect(toITAnalyticsApiQuery(IT_ANALYTICS_DEFAULT_REPORT_STATE)).toBe("period=30D");
        expect(toITAnalyticsApiQuery({ period: "7D", type: "INCIDENT", category: 4 }))
            .toBe("period=7D&type=INCIDENT&category=4");
    });

    it("links current-backlog drill-downs to the ACTIVE queue with the report's Ticket filters", () => {
        const destinations = buildITAnalyticsQueueDestinations({ type: "INCIDENT", category: 9 });
        const queue = (href: string): ReturnType<typeof parseITOperatorQueueUrlFilters> =>
            parseITOperatorQueueUrlFilters(params(href));

        expect(queue(destinations.getPriorityHref("P0")))
            .toEqual({ status: "ACTIVE", type: "INCIDENT", categoryId: 9, priority: "P0" });
        expect(queue(destinations.unassignedHref))
            .toEqual({ status: "ACTIVE", type: "INCIDENT", categoryId: 9, assignmentState: "UNASSIGNED" });
        expect(queue(destinations.untriagedHref))
            .toEqual({ status: "ACTIVE", type: "INCIDENT", categoryId: 9, triageState: "UNTRIAGED" });

        const unfiltered = buildITAnalyticsQueueDestinations({ type: null, category: null });
        expect(unfiltered.getPriorityHref("P1")).toBe("/dashboard/it?itTab=queue&queueStatus=ACTIVE&queuePriority=P1");
    });
});
