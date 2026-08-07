import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runRoutineSchedulerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/routine", () => ({
    runRoutineScheduler: runRoutineSchedulerMock,
}));

import { POST } from "@/app/api/cron/routine-scheduler/route";

const originalSecret = process.env.ROUTINE_SCHEDULER_CRON_SECRET;
const originalFeature = process.env.NEXT_PUBLIC_FEATURE_ROUTINE;

function buildRequest(secret?: string): NextRequest {
    return new NextRequest("http://localhost/api/cron/routine-scheduler", {
        method: "POST",
        headers: secret ? { "x-routine-secret": secret } : undefined,
    });
}

const result = {
    occurrencesCreated: 1,
    remindersConsidered: 2,
    outboxEnqueued: 1,
    duplicatesSkipped: 1,
    inactiveSkipped: 0,
    noRecipientSkipped: 0,
    errors: 0,
};

describe("Routine scheduler cron route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ROUTINE_SCHEDULER_CRON_SECRET;
        delete process.env.NEXT_PUBLIC_FEATURE_ROUTINE;
    });

    afterEach(() => {
        if (originalSecret === undefined) {
            delete process.env.ROUTINE_SCHEDULER_CRON_SECRET;
        } else {
            process.env.ROUTINE_SCHEDULER_CRON_SECRET = originalSecret;
        }
        if (originalFeature === undefined) {
            delete process.env.NEXT_PUBLIC_FEATURE_ROUTINE;
        } else {
            process.env.NEXT_PUBLIC_FEATURE_ROUTINE = originalFeature;
        }
    });

    it("returns 503 when the scheduler secret is not configured", async () => {
        const response = await POST(buildRequest("secret"));

        expect(response.status).toBe(503);
        expect(runRoutineSchedulerMock).not.toHaveBeenCalled();
    });

    it("returns 403 for an invalid scheduler secret", async () => {
        process.env.ROUTINE_SCHEDULER_CRON_SECRET = "expected-secret";

        const response = await POST(buildRequest("wrong-secret"));

        expect(response.status).toBe(403);
        expect(runRoutineSchedulerMock).not.toHaveBeenCalled();
    });

    it("runs the scheduler with the correct secret and returns safe counters", async () => {
        process.env.ROUTINE_SCHEDULER_CRON_SECRET = "expected-secret";
        runRoutineSchedulerMock.mockResolvedValue(result);

        const response = await POST(buildRequest("expected-secret"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, ...result });
        expect(runRoutineSchedulerMock).toHaveBeenCalledTimes(1);
    });

    it("returns a non-success status with counters when the scheduler partially fails", async () => {
        process.env.ROUTINE_SCHEDULER_CRON_SECRET = "expected-secret";
        const partialResult = { ...result, outboxEnqueued: 15, errors: 4 };
        runRoutineSchedulerMock.mockResolvedValue(partialResult);

        const response = await POST(buildRequest("expected-secret"));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            success: false,
            ...partialResult,
        });
        expect(runRoutineSchedulerMock).toHaveBeenCalledTimes(1);
    });

    it("does not generate reminders when the feature is explicitly disabled", async () => {
        process.env.ROUTINE_SCHEDULER_CRON_SECRET = "expected-secret";
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "false";

        const response = await POST(buildRequest("expected-secret"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            featureEnabled: false,
            occurrencesCreated: 0,
            remindersConsidered: 0,
            outboxEnqueued: 0,
            duplicatesSkipped: 0,
            inactiveSkipped: 0,
            noRecipientSkipped: 0,
            errors: 0,
        });
        expect(runRoutineSchedulerMock).not.toHaveBeenCalled();
    });
});
