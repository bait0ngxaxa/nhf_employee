import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
    AUDIT_LOG_RETENTION_DAYS,
    calculateAuditLogRetentionCutoff,
    cleanupExpiredAuditLogs,
} from "@/lib/services/audit-log/mutations";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Audit Log Mutations", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("calculateAuditLogRetentionCutoff", () => {
        it("returns the strict 90-day retention cutoff", () => {
            const now = new Date("2026-07-06T12:00:00.000Z");
            const cutoff = calculateAuditLogRetentionCutoff(now);

            expect(cutoff.toISOString()).toBe("2026-04-07T12:00:00.000Z");
            expect(AUDIT_LOG_RETENTION_DAYS).toBe(90);
        });
    });

    describe("cleanupExpiredAuditLogs", () => {
        it("deletes audit logs older than the retention cutoff", async () => {
            const now = new Date("2026-07-06T12:00:00.000Z");
            const cutoff = new Date("2026-04-07T12:00:00.000Z");

            prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 3 });

            const result = await cleanupExpiredAuditLogs(now);

            expect(prismaMock.auditLog.deleteMany).toHaveBeenCalledWith({
                where: {
                    createdAt: {
                        lt: cutoff,
                    },
                },
            });
            expect(result).toEqual({
                deletedCount: 3,
                cutoff,
            });
        });
    });
});
