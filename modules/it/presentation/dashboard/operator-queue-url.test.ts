import { describe, expect, it } from "vitest";

import {
    buildITOperatorQueueHref,
    getITOperatorQueueFiltersKey,
    hasITOperatorQueueUrlFilters,
    parseITOperatorQueueUrlFilters,
} from "./operator-queue-url";

function params(query: string): URLSearchParams {
    return new URL(query, "http://localhost").searchParams;
}

describe("IT operator queue URL contract", () => {
    it("defaults to the ACTIVE queue without filters", () => {
        expect(parseITOperatorQueueUrlFilters(params("/dashboard/it?itTab=queue"))).toEqual({ status: "ACTIVE" });
        expect(hasITOperatorQueueUrlFilters(params("/dashboard/it?itTab=queue"))).toBe(false);
    });

    it("round-trips every supported queue filter through the canonical link", () => {
        const filters = {
            status: "ACTIVE",
            type: "INCIDENT",
            priority: "P0",
            triageState: "UNTRIAGED",
            categoryId: 12,
            assignmentState: "UNASSIGNED",
        } as const;
        const href = buildITOperatorQueueHref(filters);

        expect(href).toBe("/dashboard/it?itTab=queue&queueStatus=ACTIVE&queueType=INCIDENT&queuePriority=P0"
            + "&queueTriage=UNTRIAGED&queueCategory=12&queueAssignment=UNASSIGNED");
        expect(parseITOperatorQueueUrlFilters(params(href))).toEqual(filters);
        expect(parseITOperatorQueueUrlFilters(params(buildITOperatorQueueHref({
            status: "ALL",
            categoryId: "uncategorized",
            assigneeUserId: 41,
            assignmentState: "ASSIGNED",
        })))).toEqual({
            status: "ALL",
            categoryId: "uncategorized",
            assignmentState: "ASSIGNED",
            assigneeUserId: 41,
        });
    });

    it("drops malformed values instead of widening or guessing filters", () => {
        expect(parseITOperatorQueueUrlFilters(params(
            "/?queueStatus=everything&queueType=incident&queuePriority=P9&queueTriage=maybe"
            + "&queueCategory=0&queueAssignment=SOMEONE&queueAssignee=-4",
        ))).toEqual({ status: "ACTIVE" });
        expect(parseITOperatorQueueUrlFilters(params("/?queueCategory=2147483648"))).toEqual({ status: "ACTIVE" });
        expect(parseITOperatorQueueUrlFilters(params("/?queueStatus=RESOLVED"))).toEqual({ status: "RESOLVED" });
    });

    it("never combines an unassigned view with a specific assignee", () => {
        expect(parseITOperatorQueueUrlFilters(params("/?queueAssignment=UNASSIGNED&queueAssignee=41")))
            .toEqual({ status: "ACTIVE", assignmentState: "UNASSIGNED" });
    });

    it("derives one stable key per filter set regardless of property order", () => {
        expect(getITOperatorQueueFiltersKey({ status: "ACTIVE", priority: "P1", type: "INCIDENT" }))
            .toBe(getITOperatorQueueFiltersKey({ type: "INCIDENT", priority: "P1", status: "ACTIVE" }));
        expect(getITOperatorQueueFiltersKey({ status: "ACTIVE", priority: "P1" }))
            .not.toBe(getITOperatorQueueFiltersKey({ status: "ACTIVE", priority: "P0" }));
    });
});
