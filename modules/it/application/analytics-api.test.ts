// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    buildContext: vi.fn(),
    getDashboard: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: mocks.requireApiSession,
}));

vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<typeof ITModule>();
    return {
        ...actual,
        buildCurrentITAuthorizationContext: mocks.buildContext,
        getITAnalyticsDashboard: mocks.getDashboard,
    };
});

import { GET } from "@/app/api/it/analytics/route";
import {
    ITAnalyticsInputValidationError,
    ITCapabilityDeniedError,
} from "@/modules/it";

const user = { id: 41, role: "USER", email: "staff@example.test", name: "Staff" };
const actorContext = {
    authorizationActor: {
        userId: 41,
        employeeId: 84,
        systemRole: "USER",
        channel: "DASHBOARD",
    },
};
const dashboard = {
    generatedAt: "2026-09-25T17:05:00.000Z",
    timeZone: "Asia/Bangkok",
    period: {
        key: "30D",
        startAt: "2026-08-27T17:00:00.000Z",
        endAt: "2026-09-25T17:05:00.000Z",
    },
    summary: {
        currentBacklog: 2,
        waitingRequester: 0,
        unassignedBacklog: 1,
        oldestUnresolvedAgeMinutes: 45,
        newTickets: 1,
        resolvedTickets: 0,
        firstRespondedTickets: 0,
        averageFirstResponseMinutes: null,
        averageResolutionMinutes: null,
    },
    trend: [],
    statusDistribution: [],
    typeDistribution: [],
    categoryBacklog: [],
    assigneeBacklog: [],
    departmentCreated: [],
};

function request(url = "http://localhost/api/it/analytics"): NextRequest {
    return new NextRequest(url);
}

function authenticate(): void {
    mocks.requireApiSession.mockResolvedValue({
        ok: true,
        user,
        session: { user },
    });
    mocks.buildContext.mockResolvedValue(actorContext);
    mocks.getDashboard.mockResolvedValue(dashboard);
}

describe("IT analytics API adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authenticate();
    });

    it("uses the existing 401 response for unauthenticated requests", async () => {
        mocks.requireApiSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ success: false }, { status: 401 }),
        });

        const response = await GET(request());

        expect(response.status).toBe(401);
        expect(mocks.getDashboard).not.toHaveBeenCalled();
    });

    it("defaults a missing period to 30D and accepts the strict supported period", async () => {
        const defaultResponse = await GET(request());
        const selectedResponse = await GET(request(
            "http://localhost/api/it/analytics?period=7D",
        ));

        expect(defaultResponse.status).toBe(200);
        expect(selectedResponse.status).toBe(200);
        expect(mocks.getDashboard).toHaveBeenNthCalledWith(1, actorContext, undefined);
        expect(mocks.getDashboard).toHaveBeenNthCalledWith(2, actorContext, "7D");
    });

    it("returns 400 for unsupported periods, duplicate periods, or client-selected filters", async () => {
        mocks.getDashboard.mockRejectedValue(new ITAnalyticsInputValidationError());
        const invalidPeriod = await GET(request(
            "http://localhost/api/it/analytics?period=365D",
        ));
        expect(invalidPeriod.status).toBe(400);

        const duplicate = await GET(request(
            "http://localhost/api/it/analytics?period=7D&period=30D",
        ));
        const forgedScope = await GET(request(
            "http://localhost/api/it/analytics?userId=41&scope=ALL",
        ));

        expect(duplicate.status).toBe(400);
        expect(forgedScope.status).toBe(400);
        expect(mocks.getDashboard).toHaveBeenCalledTimes(1);
    });

    it("rechecks analytics authority in the application and returns aggregate-only data", async () => {
        const response = await GET(request(
            "http://localhost/api/it/analytics?period=30D",
        ));
        const body: unknown = await response.json();
        const serialized = JSON.stringify(body);

        expect(response.status).toBe(200);
        expect(mocks.buildContext).toHaveBeenCalledWith(user);
        expect(mocks.getDashboard).toHaveBeenCalledWith(actorContext, "30D");
        for (const forbidden of [
            "ticketId",
            "requesterUserId",
            "requesterName",
            "email",
            "description",
            "comment",
            "attachment",
        ]) {
            expect(serialized).not.toContain(forbidden);
        }
    });

    it("returns the existing safe 403 for missing analytics authority", async () => {
        mocks.getDashboard.mockRejectedValue(new ITCapabilityDeniedError(
            "it.analytics.read",
            "NO_APPLICABLE_GRANT",
        ));

        const response = await GET(request());

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ success: false });
    });
});
