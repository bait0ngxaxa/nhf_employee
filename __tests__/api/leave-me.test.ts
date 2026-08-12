import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getLeaveProfile } from "@/app/api/leave/me/route";
import { getApiAuthSession, type ApiAuthSession } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/services/leave/get-employee-id", () => ({
    getEmployeeIdFromUserId: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
        user: { findUnique: vi.fn() },
        leaveQuota: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
        },
        leaveRequest: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}));

const ORIGINAL_TIMEZONE = process.env.TZ;

const MOCK_SESSION: ApiAuthSession = {
    user: {
        id: "1",
        role: "USER",
        email: "employee@example.com",
        name: "Employee User",
    },
};

describe("GET /api/leave/me", () => {
    beforeEach(() => {
        process.env.TZ = "America/New_York";
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-12-31T17:30:00.000Z"));
        vi.mocked(getApiAuthSession).mockResolvedValue(MOCK_SESSION);
        vi.mocked(getEmployeeIdFromUserId).mockResolvedValue(100);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            isActive: true,
            employee: { id: 100, status: "ACTIVE", deletedAt: null },
        } as never);
        vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
            if (typeof callback === "function") {
                return callback(prisma);
            }
            return callback;
        });
        vi.mocked(prisma.leaveQuota.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.leaveQuota.findMany).mockResolvedValue([]);
        vi.mocked(prisma.leaveQuota.upsert)
            .mockResolvedValueOnce({
                id: "quota-SICK",
                employeeId: 100,
                year: 2027,
                leaveType: "SICK",
                totalHalfDays: 60,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            })
            .mockResolvedValueOnce({
                id: "quota-PERSONAL",
                employeeId: 100,
                year: 2027,
                leaveType: "PERSONAL",
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            })
            .mockResolvedValueOnce({
                id: "quota-VACATION",
                employeeId: 100,
                year: 2027,
                leaveType: "VACATION",
                totalHalfDays: 12,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            });
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
        vi.mocked(prisma.leaveRequest.count).mockResolvedValue(0);
    });

    afterEach(() => {
        if (ORIGINAL_TIMEZONE === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = ORIGINAL_TIMEZONE;
        }
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("creates new-year quotas using Thailand business year", async () => {
        const response = await getLeaveProfile(
            new Request("http://localhost/api/leave/me?page=1&limit=10"),
        );

        expect(response.status).toBe(200);
        expect(prisma.leaveQuota.upsert).toHaveBeenCalledTimes(3);
        for (const leaveType of ["SICK", "PERSONAL", "VACATION"] as const) {
            expect(prisma.leaveQuota.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        employeeId_year_leaveType: {
                            employeeId: 100,
                            year: 2027,
                            leaveType,
                        },
                    },
                    create: expect.objectContaining({
                        year: 2027,
                        leaveType,
                        carryBalanceHalfDays: 0,
                        usedHalfDays: 0,
                    }),
                }),
            );
        }
    });

    it("returns signed carry, effective entitlement, and remaining balance", async () => {
        vi.mocked(prisma.leaveQuota.findFirst)
            .mockReset()
            .mockResolvedValueOnce({
                id: "personal-2026",
                employeeId: 100,
                year: 2026,
                leaveType: "PERSONAL",
                totalHalfDays: 20,
                carryBalanceHalfDays: 0,
                usedHalfDays: 6,
            })
            .mockResolvedValueOnce({
                id: "vacation-2026",
                employeeId: 100,
                year: 2026,
                leaveType: "VACATION",
                totalHalfDays: 12,
                carryBalanceHalfDays: 0,
                usedHalfDays: 16,
            });
        vi.mocked(prisma.leaveQuota.upsert)
            .mockReset()
            .mockResolvedValueOnce({
                id: "sick-2027",
                employeeId: 100,
                year: 2027,
                leaveType: "SICK",
                totalHalfDays: 60,
                carryBalanceHalfDays: 0,
                usedHalfDays: 0,
            })
            .mockResolvedValueOnce({
                id: "personal-2027",
                employeeId: 100,
                year: 2027,
                leaveType: "PERSONAL",
                totalHalfDays: 20,
                carryBalanceHalfDays: 14,
                usedHalfDays: 10,
            })
            .mockResolvedValueOnce({
                id: "vacation-2027",
                employeeId: 100,
                year: 2027,
                leaveType: "VACATION",
                totalHalfDays: 12,
                carryBalanceHalfDays: -4,
                usedHalfDays: 2,
            });

        const response = await getLeaveProfile(
            new Request("http://localhost/api/leave/me?page=1&limit=10"),
        );
        const body = await response.json();

        expect(body.quotas).toEqual([
            expect.objectContaining({
                leaveType: "SICK",
                totalDays: 30,
                carryBalanceDays: 0,
                effectiveTotalDays: 30,
                usedDays: 0,
                remainingDays: 30,
            }),
            expect.objectContaining({
                leaveType: "PERSONAL",
                totalDays: 10,
                carryBalanceDays: 7,
                effectiveTotalDays: 17,
                usedDays: 5,
                remainingDays: 12,
            }),
            expect.objectContaining({
                leaveType: "VACATION",
                totalDays: 6,
                carryBalanceDays: -2,
                effectiveTotalDays: 4,
                usedDays: 1,
                remainingDays: 3,
            }),
        ]);
    });

    it("returns private attachment summaries without storage metadata", async () => {
        vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([
            {
                id: "leave-1",
                employeeId: 100,
                leaveType: "SICK",
                startDate: new Date("2027-01-04T00:00:00.000Z"),
                endDate: new Date("2027-01-04T00:00:00.000Z"),
                period: "FULL_DAY",
                durationHalfDays: 2,
                reason: "พักรักษาตัว",
                emergencyReason: null,
                specialReason: null,
                overQuotaHalfDays: 0,
                status: "PENDING",
                approverId: 200,
                approvedAt: null,
                rejectReason: null,
                notTakenReason: null,
                notTakenRequestedAt: null,
                notTakenConfirmedAt: null,
                notTakenConfirmedById: null,
                attachmentUrl: null,
                createdAt: new Date("2027-01-01T00:00:00.000Z"),
                updatedAt: new Date("2027-01-01T00:00:00.000Z"),
                approver: null,
                attachments: [
                    {
                        id: "attachment-1",
                        contentType: "image/webp",
                        sizeBytes: 12_345,
                        width: 1200,
                        height: 800,
                    },
                ],
            },
        ] as never);
        vi.mocked(prisma.leaveRequest.count).mockResolvedValue(1);

        const response = await getLeaveProfile(
            new Request("http://localhost/api/leave/me?page=1&limit=10"),
        );
        const body = await response.json();

        expect(body.history[0].attachments).toEqual([
            {
                id: "attachment-1",
                contentType: "image/webp",
                sizeBytes: 12_345,
                width: 1200,
                height: 800,
                viewUrl: "/api/leave/attachments/attachment-1",
            },
        ]);
        expect(JSON.stringify(body)).not.toContain("storageKey");
        expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 0,
                take: 10,
                orderBy: { createdAt: "desc" },
                include: expect.objectContaining({
                    attachments: expect.objectContaining({
                        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                    }),
                }),
            }),
        );
    });
});
