import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/leave/attachments/cleanup/route";
import { cleanupOrphanedLeaveAttachments } from "@/lib/services/leave/cleanup-orphans";

vi.mock("@/lib/services/leave/cleanup-orphans", () => ({
    cleanupOrphanedLeaveAttachments: vi.fn(),
}));

function createRequest(secret?: string, dryRun?: boolean): NextRequest {
    return new NextRequest(
        `http://localhost/api/leave/attachments/cleanup${dryRun ? "?dryRun=true" : ""}`,
        {
            method: "POST",
            headers: secret ? { "x-cleanup-secret": secret } : undefined,
        },
    );
}

describe("leave attachment cleanup route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("LEAVE_ATTACHMENT_CLEANUP_SECRET", "cleanup-secret");
        vi.mocked(cleanupOrphanedLeaveAttachments).mockResolvedValue({
            scannedCount: 4,
            orphanCount: 2,
            deletedCount: 1,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: false,
            cutoff: new Date("2035-01-01T00:00:00.000Z"),
        });
    });

    it("requires the configured secret", async () => {
        const response = await POST(createRequest("wrong-secret"));

        expect(response.status).toBe(403);
        expect(cleanupOrphanedLeaveAttachments).not.toHaveBeenCalled();
    });

    it("passes dry-run mode and returns counts without file details", async () => {
        vi.mocked(cleanupOrphanedLeaveAttachments).mockResolvedValueOnce({
            scannedCount: 4,
            orphanCount: 2,
            deletedCount: 0,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: true,
            cutoff: new Date("2035-01-01T00:00:00.000Z"),
        });

        const response = await POST(createRequest("cleanup-secret", true));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(cleanupOrphanedLeaveAttachments).toHaveBeenCalledWith({
            dryRun: true,
        });
        expect(body).toEqual({
            success: true,
            scannedCount: 4,
            orphanCount: 2,
            deletedCount: 0,
            failedCount: 0,
            skippedRecentCount: 1,
            dryRun: true,
            cutoff: "2035-01-01T00:00:00.000Z",
        });
        expect(JSON.stringify(body)).not.toContain("storageKey");
    });

    it("does not reveal cleanup internals on service failure", async () => {
        vi.mocked(cleanupOrphanedLeaveAttachments).mockRejectedValueOnce(
            new Error("database failed"),
        );

        const response = await POST(createRequest("cleanup-secret"));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            error: "Internal server error",
        });
    });

    it("rejects an ambiguous dry-run value instead of deleting files", async () => {
        const response = await POST(
            new NextRequest(
                "http://localhost/api/leave/attachments/cleanup?dryRun=maybe",
                {
                    method: "POST",
                    headers: { "x-cleanup-secret": "cleanup-secret" },
                },
            ),
        );

        expect(response.status).toBe(400);
        expect(cleanupOrphanedLeaveAttachments).not.toHaveBeenCalled();
    });
});
