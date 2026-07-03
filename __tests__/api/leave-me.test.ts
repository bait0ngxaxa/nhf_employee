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
        leaveQuota: {
            findMany: vi.fn(),
            createMany: vi.fn(),
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
        vi.mocked(prisma.leaveQuota.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        vi.mocked(prisma.leaveQuota.createMany).mockResolvedValue({ count: 3 });
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
        expect(prisma.leaveQuota.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({ year: 2027, leaveType: "SICK" }),
                expect.objectContaining({ year: 2027, leaveType: "PERSONAL" }),
                expect.objectContaining({ year: 2027, leaveType: "VACATION" }),
            ],
            skipDuplicates: true,
        });
    });
});
