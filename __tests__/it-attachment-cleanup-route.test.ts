// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({ cleanup: vi.fn() }));

vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<typeof ITModule>();
    return { ...actual, cleanupOrphanedITTicketAttachments: mocks.cleanup };
});

import { POST } from "@/app/api/it/attachments/cleanup/route";

const originalSecret = process.env.IT_ATTACHMENT_CLEANUP_SECRET;

function request(query = "", secret?: string): Request {
    return new Request(`http://localhost/api/it/attachments/cleanup${query}`, {
        method: "POST",
        headers: secret === undefined ? {} : { "x-cleanup-secret": secret },
    });
}

afterEach(() => {
    if (originalSecret === undefined) delete process.env.IT_ATTACHMENT_CLEANUP_SECRET;
    else process.env.IT_ATTACHMENT_CLEANUP_SECRET = originalSecret;
});

describe("IT attachment cleanup maintenance route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.IT_ATTACHMENT_CLEANUP_SECRET = "test-only-secret";
        mocks.cleanup.mockResolvedValue({
            scannedCount: 4,
            orphanCount: 2,
            deletedCount: 1,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: false,
        });
    });

    it("returns safe 503 when the dedicated secret is missing and 403 on mismatch", async () => {
        delete process.env.IT_ATTACHMENT_CLEANUP_SECRET;
        expect((await POST(request())).status).toBe(503);
        expect(mocks.cleanup).not.toHaveBeenCalled();

        process.env.IT_ATTACHMENT_CLEANUP_SECRET = "test-only-secret";
        expect((await POST(request("", "wrong-secret"))).status).toBe(403);
        expect(mocks.cleanup).not.toHaveBeenCalled();
    });

    it("strictly parses dryRun and returns counts without file details", async () => {
        const invalid = await POST(request("?dryRun=yes", "test-only-secret"));
        expect(invalid.status).toBe(400);
        expect(mocks.cleanup).not.toHaveBeenCalled();

        const duplicate = await POST(request("?dryRun=true&dryRun=false", "test-only-secret"));
        expect(duplicate.status).toBe(400);

        mocks.cleanup.mockResolvedValueOnce({
            scannedCount: 4,
            orphanCount: 2,
            deletedCount: 0,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: true,
        });
        const valid = await POST(request("?dryRun=true", "test-only-secret"));
        expect(valid.status).toBe(200);
        expect(mocks.cleanup).toHaveBeenCalledWith({ dryRun: true });
        const body: unknown = await valid.json();
        expect(body).toMatchObject({
            success: true,
            scannedCount: 4,
            orphanCount: 2,
            deletedCount: 0,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: true,
        });
        expect(JSON.stringify(body)).not.toMatch(/storageKey|filename|\.uploads|it\/\d+/);
    });

    it("defaults to deletion mode and masks cleanup errors", async () => {
        const response = await POST(request("", "test-only-secret"));
        expect(response.status).toBe(200);
        expect(mocks.cleanup).toHaveBeenCalledWith({ dryRun: false });

        mocks.cleanup.mockRejectedValueOnce(new Error("private path must not be returned"));
        const failed = await POST(request("", "test-only-secret"));
        expect(failed.status).toBe(500);
        expect(await failed.text()).not.toContain("private path");
    });
});
