import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { processOutboxMock } = vi.hoisted(() => ({
    processOutboxMock: vi.fn(),
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: processOutboxMock,
}));

import { POST } from "@/app/api/cron/notification-outbox/route";

const originalSecret = process.env.NOTIFICATION_OUTBOX_CRON_SECRET;

function buildRequest(secret?: string): NextRequest {
    return new NextRequest("http://localhost/api/cron/notification-outbox", {
        method: "POST",
        headers: secret ? { "x-outbox-secret": secret } : undefined,
    });
}

describe("notification outbox cron route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.NOTIFICATION_OUTBOX_CRON_SECRET;
    });

    afterEach(() => {
        if (originalSecret === undefined) {
            delete process.env.NOTIFICATION_OUTBOX_CRON_SECRET;
            return;
        }
        process.env.NOTIFICATION_OUTBOX_CRON_SECRET = originalSecret;
    });

    it("rejects requests when the worker secret is not configured", async () => {
        const response = await POST(buildRequest("secret"));

        expect(response.status).toBe(503);
        expect(processOutboxMock).not.toHaveBeenCalled();
    });

    it("rejects requests with an invalid worker secret", async () => {
        process.env.NOTIFICATION_OUTBOX_CRON_SECRET = "expected-secret";

        const response = await POST(buildRequest("wrong-secret"));

        expect(response.status).toBe(403);
        expect(processOutboxMock).not.toHaveBeenCalled();
    });

    it("processes queued notifications independently of leave API requests", async () => {
        process.env.NOTIFICATION_OUTBOX_CRON_SECRET = "expected-secret";
        processOutboxMock.mockResolvedValue({ processed: 1, failed: 0 });

        const response = await POST(buildRequest("expected-secret"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            processed: 1,
            failed: 0,
        });
        expect(processOutboxMock).toHaveBeenCalledTimes(1);
    });
});
