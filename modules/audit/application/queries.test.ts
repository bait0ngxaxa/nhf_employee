import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAuditEntityHistory, getAuditLogs } from "./queries";

vi.mock("@/lib/db/prisma", () => ({
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
            ] as never);

            const result = await getAuditLogs({ page: 1, limit: 10 });

            expect(result.pagination.total).toBe(1);
            expect(result.auditLogs[0].details).toEqual({ foo: "bar" });
        });

        it("preserves both historical familyId and new familyCorrelation metadata", async () => {
            prismaMock.auditLog.count.mockResolvedValue(2);
            prismaMock.auditLog.findMany.mockResolvedValue([
                {
                    id: 1,
                    details: JSON.stringify({
                        metadata: { familyId: "historical-family-id" },
                    }),
                },
                {
                    id: 2,
                    details: JSON.stringify({
                        metadata: { familyCorrelation: "0123456789abcdef" },
                    }),
                },
            ] as never);

            const result = await getAuditLogs({ page: 1, limit: 10 });

            expect(result.auditLogs.map((log) => log.details)).toEqual([
                { metadata: { familyId: "historical-family-id" } },
                { metadata: { familyCorrelation: "0123456789abcdef" } },
            ]);
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

        it("searches audit actors by employee nickname on the server", async () => {
            prismaMock.auditLog.count.mockResolvedValue(0);
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            await getAuditLogs({ page: 1, limit: 10, search: "ชาย" });

            expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            {
                                user: {
                                    is: {
                                        employee: {
                                            is: {
                                                OR: expect.arrayContaining([
                                                    { nickname: { contains: "ชาย" } },
                                                ]),
                                            },
                                        },
                                    },
                                },
                            },
                        ]),
                    }),
                }),
            );
        });

        it("should handle invalid JSON details gracefully", async () => {
            prismaMock.auditLog.count.mockResolvedValue(1);
            prismaMock.auditLog.findMany.mockResolvedValue([
                { id: 1, details: "invalid-json" },
            ] as never);

            const result = await getAuditLogs({ page: 1, limit: 10 });

            expect(result.auditLogs[0].details).toBeNull();
        });

        it("preserves page normalization and the one-to-one query limit clamp", async () => {
            prismaMock.auditLog.count.mockResolvedValue(0);
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            const result = await getAuditLogs({ page: 0, limit: 500 });

            expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 0, take: 100 }),
            );
            expect(result.pagination).toEqual({
                page: 1,
                limit: 100,
                total: 0,
                pages: 0,
            });
        });

        it("matches an exact AuditAction value when searching", async () => {
            prismaMock.auditLog.count.mockResolvedValue(0);
            prismaMock.auditLog.findMany.mockResolvedValue([]);

            await getAuditLogs({ page: 1, limit: 10, search: "login_success" });

            expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.arrayContaining([
                            { action: { equals: "LOGIN_SUCCESS" } },
                        ]),
                    }),
                }),
            );
        });
    });

    describe("getAuditEntityHistory", () => {
        it("returns raw feature-owned history rows without parsing details", async () => {
            const createdAt = new Date("2026-08-01T00:00:00.000Z");
            const rows = [{
                id: 7,
                action: "ROUTINE_OCCURRENCE_REASSIGN",
                userId: 3,
                userEmail: "admin@thainhf.org",
                details: '{"after":{"employeeId":21}}',
                createdAt,
            }];
            prismaMock.auditLog.findMany.mockResolvedValue(rows as never);

            await expect(getAuditEntityHistory({
                entityType: "RoutineOccurrence",
                entityId: 91,
                limit: 100,
            })).resolves.toEqual(rows);

            expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
                where: { entityType: "RoutineOccurrence", entityId: 91 },
                select: {
                    id: true,
                    action: true,
                    userId: true,
                    userEmail: true,
                    details: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 100,
            });
        });
    });

    describe("sensitive leave special-reason records", () => {
        const CANARY = "CANARY-QUERY-เหตุผลพิเศษส่วนตัว";
        const legacyDetails = JSON.stringify({
            before: { status: "PENDING", specialReason: null },
            after: { status: "PENDING", specialReason: CANARY },
            metadata: { leaveRequestId: "cm0leave0002", leaveType: "VACATION", reason: CANARY },
        });

        it("never returns raw legacy reason text from the paginated audit view", async () => {
            const unrelated = {
                id: 2,
                action: "LEAVE_REQUEST_REJECT",
                details: JSON.stringify({ after: { status: "REJECTED", reason: "เอกสารไม่ครบ" } }),
            };
            prismaMock.auditLog.count.mockResolvedValue(3);
            prismaMock.auditLog.findMany.mockResolvedValue([
                { id: 1, action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", userId: 8, userEmail: "requester@thainhf.org", details: legacyDetails },
                unrelated,
                { id: 3, action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", details: `{"after":"${CANARY}"` },
            ] as never);

            const result = await getAuditLogs({ page: 1, limit: 10 });

            expect(JSON.stringify(result)).not.toContain("CANARY");
            expect(result.auditLogs[0]).toMatchObject({
                id: 1,
                action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE",
                userId: 8,
                userEmail: "requester@thainhf.org",
                details: {
                    before: { status: "PENDING", hasSpecialReason: false },
                    after: { status: "PENDING", hasSpecialReason: true },
                    metadata: { leaveRequestId: "cm0leave0002", leaveType: "VACATION", changeType: "ADDED" },
                },
            });
            expect(result.auditLogs[1].details).toEqual({ after: { status: "REJECTED", reason: "เอกสารไม่ครบ" } });
            expect(result.auditLogs[2].details).toBeNull();
            expect(result.pagination.total).toBe(3);
        });

        it("projects protected rows returned to feature-owned history readers", async () => {
            prismaMock.auditLog.findMany.mockResolvedValue([
                { id: 9, action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", userId: 8, userEmail: null, details: legacyDetails, createdAt: new Date() },
            ] as never);

            const rows = await getAuditEntityHistory({ entityType: "LeaveRequest", entityId: 1, limit: 10 });

            expect(JSON.stringify(rows)).not.toContain("CANARY");
            expect(rows[0]).toMatchObject({ id: 9, action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", userId: 8 });
        });
    });
});
