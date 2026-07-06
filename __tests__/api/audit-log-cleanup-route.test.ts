// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { cleanupExpiredAuditLogsMock } = vi.hoisted(() => ({
    cleanupExpiredAuditLogsMock: vi.fn(),
}));

vi.mock("@/lib/services/audit-log", () => ({
    auditLogService: {
        cleanupExpiredAuditLogs: cleanupExpiredAuditLogsMock,
    },
}));

import { POST as cleanupAuditLogsRoute } from "@/app/api/audit-logs/cleanup/route";

const originalSecret = process.env.AUDIT_LOG_CLEANUP_SECRET;

function buildRequest(secret?: string): NextRequest {
    return new NextRequest("http://localhost/api/audit-logs/cleanup", {
        method: "POST",
        headers: secret ? { "x-cleanup-secret": secret } : undefined,
    });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    return (await response.json()) as Record<string, unknown>;
}

describe("Audit log cleanup route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.AUDIT_LOG_CLEANUP_SECRET;
    });

    afterEach(() => {
        if (originalSecret === undefined) {
            delete process.env.AUDIT_LOG_CLEANUP_SECRET;
            return;
        }

        process.env.AUDIT_LOG_CLEANUP_SECRET = originalSecret;
    });

    it("returns 503 when cleanup secret is not configured", async () => {
        const response = await cleanupAuditLogsRoute(buildRequest("secret"));

        expect(response.status).toBe(503);
        expect(cleanupExpiredAuditLogsMock).not.toHaveBeenCalled();
    });

    it("returns 403 when cleanup secret header is invalid", async () => {
        process.env.AUDIT_LOG_CLEANUP_SECRET = "expected-secret";

        const response = await cleanupAuditLogsRoute(buildRequest("wrong-secret"));

        expect(response.status).toBe(403);
        expect(cleanupExpiredAuditLogsMock).not.toHaveBeenCalled();
    });

    it("deletes expired audit logs when cleanup secret matches", async () => {
        process.env.AUDIT_LOG_CLEANUP_SECRET = "expected-secret";
        cleanupExpiredAuditLogsMock.mockResolvedValue({
            deletedCount: 4,
            cutoff: new Date("2026-04-07T12:00:00.000Z"),
        });

        const response = await cleanupAuditLogsRoute(
            buildRequest("expected-secret"),
        );
        const body = await readJson(response);

        expect(response.status).toBe(200);
        expect(cleanupExpiredAuditLogsMock).toHaveBeenCalledTimes(1);
        expect(body).toEqual({
            success: true,
            deletedCount: 4,
            cutoff: "2026-04-07T12:00:00.000Z",
        });
    });
});
