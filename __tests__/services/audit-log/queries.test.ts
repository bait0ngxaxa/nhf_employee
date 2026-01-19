import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { prisma } from "@/lib/prisma";
import { getAuditLogs } from "@/lib/services/audit-log/queries";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

describe("Audit Log Queries", () => {
    beforeEach(() => {
        mockReset(prismaMock);
    });

    describe("getAuditLogs", () => {
        it("should fetch paginated logs", async () => {
            prismaMock.auditLog.count.mockResolvedValue(1);
            prismaMock.auditLog.findMany.mockResolvedValue([
                { id: 1, details: '{"foo":"bar"}' },
            ] as any);

            const result = await getAuditLogs({ page: 1, limit: 10 });

            expect(result.pagination.total).toBe(1);
            expect(result.auditLogs[0].details).toEqual({ foo: "bar" });
        });

        it("should handle filters", async () => {
            prismaMock.auditLog.count.mockResolvedValue(0);
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            const startDate = new Date("2023-01-01");
            const endDate = new Date("2023-01-02");

            await getAuditLogs({
                page: 1,
                limit: 10,
                action: "CREATE",
                userId: 99,
                startDate,
                endDate,
            });

            expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        action: "CREATE",
                        userId: 99,
                        createdAt: {
                            gte: startDate,
                            lte: endDate,
                        },
                    }),
                }),
            );
        });

        it("should handle invalid JSON details gracefully", async () => {
            prismaMock.auditLog.count.mockResolvedValue(1);
            prismaMock.auditLog.findMany.mockResolvedValue([
                { id: 1, details: "invalid-json" },
            ] as any);

            const result = await getAuditLogs({ page: 1, limit: 10 });

            expect(result.auditLogs[0].details).toBeNull();
        });
    });
});
