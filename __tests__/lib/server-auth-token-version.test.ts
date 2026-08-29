// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock, verifyAccessTokenMock, prismaMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    verifyAccessTokenMock: vi.fn(),
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
        leaveRequest: {
            findFirst: vi.fn(),
        },
        authRefreshToken: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("next/headers", () => ({
    cookies: cookiesMock,
}));

vi.mock("@/lib/auth/hybrid/tokens", () => ({
    verifyAccessToken: verifyAccessTokenMock,
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: prismaMock,
}));

import { getApiAuthSession } from "@/lib/auth/server";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/auth/hybrid/constants";

type CapabilityFixture = {
    role?: "USER" | "ADMIN";
    subordinates?: Array<{ id: number }>;
    approvals?: Array<{ id: string }>;
    exceptionApprovals?: Array<{ id: string }>;
    approvalHistory?: { id: string } | null;
};

function mockActiveCapabilityUser({
    role = "USER",
    subordinates = [],
    approvals = [],
    exceptionApprovals = [],
    approvalHistory = null,
}: CapabilityFixture = {}): void {
    verifyAccessTokenMock.mockResolvedValue({
        sub: "1",
        role,
        sessionId: "session-1",
        tokenVersion: 1,
    });
    prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        role,
        email: "employee@test.com",
        name: "Employee",
        isActive: true,
        tokenVersion: 1,
        employee: {
            id: 1,
            status: "ACTIVE",
            deletedAt: null,
            dept: null,
            subordinates,
            approvals,
            exceptionApprovals,
        },
    });
    prismaMock.leaveRequest.findFirst.mockResolvedValue(approvalHistory);
}

describe("server auth tokenVersion validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_ACCESS_COOKIE_NAME ? { value: "access.token" } : undefined,
            ),
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({ id: "session-1" });
        prismaMock.authRefreshToken.findUnique.mockResolvedValue(null);
        prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
    });

    it("returns null when access token version mismatches current user tokenVersion", async () => {
        verifyAccessTokenMock.mockResolvedValue({
            sub: "1",
            role: "ADMIN",
            sessionId: "session-1",
            tokenVersion: 1,
        });

        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
            isActive: true,
            tokenVersion: 2,
            employee: null,
        });

        const session = await getApiAuthSession();
        expect(session).toBeNull();
    });

    it("returns null when the linked employee is inactive even if the user is active", async () => {
        verifyAccessTokenMock.mockResolvedValue({
            sub: "1",
            role: "USER",
            sessionId: "session-1",
            tokenVersion: 1,
        });

        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "USER",
            email: "employee@test.com",
            name: "Employee",
            isActive: true,
            tokenVersion: 1,
            employee: {
                status: "INACTIVE",
                deletedAt: null,
                dept: null,
                subordinates: [],
                approvals: [],
                exceptionApprovals: [],
            },
        });

        const session = await getApiAuthSession();

        expect(session).toBeNull();
    });

    it("uses the canonical Employee identity in an active session", async () => {
        verifyAccessTokenMock.mockResolvedValue({
            sub: "1",
            role: "USER",
            sessionId: "session-1",
            tokenVersion: 1,
        });
        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "USER",
            email: "employee@test.com",
            name: "ชื่อผู้ใช้เดิม",
            isActive: true,
            tokenVersion: 1,
            employee: {
                id: 1,
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: "ชาย",
                status: "ACTIVE",
                deletedAt: null,
                dept: null,
                subordinates: [],
                approvals: [],
                exceptionApprovals: [],
            },
        });

        const session = await getApiAuthSession();

        expect(session?.user.name).toBe("สมชาย ใจดี (ชาย)");
    });

    it("queries only actionable effective approver assignments for leave capability", async () => {
        mockActiveCapabilityUser();

        await getApiAuthSession();

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            include: {
                employee: expect.objectContaining({
                    include: expect.objectContaining({
                        approvals: {
                            where: {
                                exceptionApproverId: null,
                                OR: [
                                    { status: "PENDING" },
                                    {
                                        status: "APPROVED",
                                        notTakenRequestedAt: { not: null },
                                        notTakenConfirmedAt: null,
                                    },
                                    { status: "CANCELLATION_REQUESTED" },
                                ],
                            },
                            select: { id: true },
                            take: 1,
                        },
                        exceptionApprovals: {
                            where: {
                                OR: [
                                    { status: "PENDING" },
                                    {
                                        status: "APPROVED",
                                        notTakenRequestedAt: { not: null },
                                        notTakenConfirmedAt: null,
                                    },
                                    { status: "CANCELLATION_REQUESTED" },
                                ],
                            },
                            select: { id: true },
                            take: 1,
                        },
                    }),
                }),
            },
        }));
    });

    it("queries report history separately from actionable approval work", async () => {
        mockActiveCapabilityUser();

        await getApiAuthSession();

        expect(prismaMock.leaveRequest.findFirst).toHaveBeenCalledWith({
            where: {
                approverId: 1,
                status: {
                    in: [
                        "PENDING",
                        "APPROVED",
                        "REJECTED",
                        "CANCELLED",
                        "NOT_TAKEN",
                        "CANCELLATION_REQUESTED",
                        "CANCELLED_AFTER_APPROVAL",
                    ],
                },
            },
            select: { id: true },
        });
    });

    it("grants capability for current exception approver work", async () => {
        mockActiveCapabilityUser({
            role: "ADMIN",
            exceptionApprovals: [{ id: "cancellation-leave" }],
        });

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(true);
        expect(session?.user.canViewLeaveReports).toBe(false);
    });

    it("does not grant leave approval capability to an unassigned admin", async () => {
        mockActiveCapabilityUser({ role: "ADMIN" });

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(false);
        expect(session?.user.canViewLeaveReports).toBe(false);
    });

    it("preserves leave approval capability for an organizational manager", async () => {
        mockActiveCapabilityUser({ subordinates: [{ id: 2 }] });

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(true);
        expect(session?.user.canApproveLeave).toBe(true);
        expect(session?.user.canViewLeaveReports).toBe(true);
    });

    it("grants capability for current pending original approver work", async () => {
        mockActiveCapabilityUser({
            approvals: [{ id: "pending-leave" }],
            approvalHistory: { id: "pending-leave" },
        });

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(true);
        expect(session?.user.canViewLeaveReports).toBe(true);
    });

    it("keeps report access without approval capability for historical original approver work", async () => {
        mockActiveCapabilityUser({ approvalHistory: { id: "completed-leave" } });

        const session = await getApiAuthSession();

        expect(session?.user.canApproveLeave).toBe(false);
        expect(session?.user.canViewLeaveReports).toBe(true);
    });

    it("does not grant leave capabilities to a normal employee", async () => {
        mockActiveCapabilityUser();

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(false);
        expect(session?.user.canViewLeaveReports).toBe(false);
    });

    it("keeps admin recovery additive to historical report access", async () => {
        mockActiveCapabilityUser({
            role: "ADMIN",
            approvalHistory: { id: "completed-leave" },
        });

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(false);
        expect(session?.user.canViewLeaveReports).toBe(true);
    });

    it("does not grant capability for a historical not-taken exception assignment", async () => {
        mockActiveCapabilityUser({ role: "ADMIN" });

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(false);
    });

    it("does not grant capability for a historical cancelled exception assignment", async () => {
        mockActiveCapabilityUser({ role: "ADMIN" });

        const session = await getApiAuthSession();

        expect(session?.user.canApproveLeave).toBe(false);
    });

    it("does not retain original approver capability after an exception replacement", async () => {
        mockActiveCapabilityUser();

        const session = await getApiAuthSession();

        expect(session?.user.isManager).toBe(false);
        expect(session?.user.canApproveLeave).toBe(false);
    });

    it("returns null when only a refresh token is present", async () => {
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) =>
                name === HYBRID_REFRESH_COOKIE_NAME ? { value: "refresh.token" } : undefined,
            ),
        });

        const session = await getApiAuthSession();

        expect(session).toBeNull();
        expect(verifyAccessTokenMock).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when access token verification fails with refresh token present", async () => {
        cookiesMock.mockResolvedValue({
            get: vi.fn((name: string) => {
                if (name === HYBRID_ACCESS_COOKIE_NAME) return { value: "bad.access.token" };
                if (name === HYBRID_REFRESH_COOKIE_NAME) return { value: "refresh.token" };
                return undefined;
            }),
        });
        verifyAccessTokenMock.mockRejectedValue(new Error("invalid access token"));

        const session = await getApiAuthSession();

        expect(session).toBeNull();
        expect(prismaMock.authRefreshToken.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when access JWT belongs to a revoked session family", async () => {
        verifyAccessTokenMock.mockResolvedValue({
            sub: "1",
            role: "ADMIN",
            sessionId: "revoked-family",
            tokenVersion: 1,
        });
        prismaMock.authRefreshToken.findFirst.mockResolvedValue(null);
        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "ADMIN",
            email: "admin@test.com",
            name: "Admin",
            isActive: true,
            tokenVersion: 1,
            employee: null,
        });

        const session = await getApiAuthSession();

        expect(session).toBeNull();
        expect(prismaMock.authRefreshToken.findFirst).toHaveBeenCalledWith({
            where: {
                userId: 1,
                familyId: "revoked-family",
                revokedAt: null,
                expiresAt: { gt: expect.any(Date) },
            },
            select: { id: true },
        });
    });
});

