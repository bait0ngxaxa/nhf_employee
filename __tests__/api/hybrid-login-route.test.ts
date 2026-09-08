// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as hybridLoginRoute } from "@/app/api/auth/hybrid-login/route";
import { resetAuthRateLimit } from "@/lib/auth/rate-limit";
import { HYBRID_ACCESS_COOKIE_NAME } from "@/lib/auth/hybrid/constants";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";

const {
    appendAuditBestEffortMock,
    compareMock,
    issueAccessTokenMock,
    prismaMock,
} = vi.hoisted(() => ({
    appendAuditBestEffortMock: vi.fn(),
    compareMock: vi.fn(),
    issueAccessTokenMock: vi.fn(),
    prismaMock: {
        user: { findUnique: vi.fn() },
        authRefreshToken: { create: vi.fn() },
    },
}));

vi.mock("bcryptjs", () => ({
    default: { compare: compareMock },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/modules/audit", () => ({
    appendAuditBestEffort: appendAuditBestEffortMock,
}));

vi.mock("@/lib/auth/hybrid/tokens", () => ({
    buildRefreshTokenRecord: vi.fn(() => ({
        rawToken: "refresh-token",
        record: {
            userId: 7,
            tokenHash: "refresh-token-hash",
            familyId: "family-1",
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            userAgent: "Vitest",
            ipAddress: "127.0.0.1",
        },
    })),
    issueAccessToken: issueAccessTokenMock,
    getAccessTokenTtlSeconds: vi.fn(() => 900),
    getRefreshTokenTtlSeconds: vi.fn(() => 2_592_000),
}));

function buildRequest(email = "user@thainhf.org"): NextRequest {
    return new NextRequest("http://localhost/api/auth/hybrid-login", {
        method: "POST",
        headers: {
            origin: "http://localhost",
            "x-requested-with": "XMLHttpRequest",
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.10",
            "x-forwarded-for": "198.51.100.1",
            "user-agent": "hybrid-login-test-agent",
        },
        body: JSON.stringify({
            email,
            password: "secret1",
        }),
    });
}

function buildUser(employee: {
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    deletedAt: Date | null;
} | null) {
    return {
        id: 7,
        email: "user@thainhf.org",
        name: "Test User",
        password: "hashed-password",
        role: "USER",
        isActive: true,
        deletedAt: null,
        tokenVersion: 1,
        employee,
    };
}

describe("Hybrid login route employee eligibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAuthRateLimit();
        resetMutationRateLimit();
        compareMock.mockResolvedValue(true);
        issueAccessTokenMock.mockResolvedValue("access-token");
        prismaMock.authRefreshToken.create.mockResolvedValue({ id: "rt-1" });
        appendAuditBestEffortMock.mockResolvedValue(undefined);
    });

    it("records LOGIN_SUCCESS after refresh-session persistence and before the response", async () => {
        prismaMock.user.findUnique.mockResolvedValue(buildUser({
            status: "ACTIVE",
            deletedAt: null,
        }));

        let releaseAudit: () => void = () => undefined;
        const auditGate = new Promise<void>((resolve) => {
            releaseAudit = resolve;
        });
        appendAuditBestEffortMock.mockImplementationOnce(() => auditGate);

        const responsePromise = hybridLoginRoute(buildRequest("USER@thainhf.org"));
        await vi.waitFor(() => {
            expect(appendAuditBestEffortMock).toHaveBeenCalledTimes(1);
        });

        let responseSettled = false;
        void responsePromise.then(() => {
            responseSettled = true;
        });
        await Promise.resolve();
        expect(responseSettled).toBe(false);

        releaseAudit();
        const response = await responsePromise;

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.create).toHaveBeenCalledTimes(1);
        expect(appendAuditBestEffortMock).toHaveBeenCalledWith({
            action: "LOGIN_SUCCESS",
            entityType: "User",
            entityId: 7,
            userId: 7,
            userEmail: "user@thainhf.org",
            ipAddress: "203.0.113.10",
            userAgent: "hybrid-login-test-agent",
            details: { metadata: { method: "hybrid_login" } },
        });
        expect(prismaMock.authRefreshToken.create.mock.invocationCallOrder[0])
            .toBeLessThan(appendAuditBestEffortMock.mock.invocationCallOrder[0]);
        expect(response.headers.get("set-cookie")).toContain(HYBRID_ACCESS_COOKIE_NAME);
    });

    it("records LOGIN_FAILED after the authentication decision without emitting success", async () => {
        compareMock.mockResolvedValue(false);
        prismaMock.user.findUnique.mockResolvedValue(buildUser({
            status: "ACTIVE",
            deletedAt: null,
        }));

        let releaseAudit: () => void = () => undefined;
        const auditGate = new Promise<void>((resolve) => {
            releaseAudit = resolve;
        });
        appendAuditBestEffortMock.mockImplementationOnce(() => auditGate);

        const responsePromise = hybridLoginRoute(buildRequest("USER@thainhf.org"));
        await vi.waitFor(() => {
            expect(appendAuditBestEffortMock).toHaveBeenCalledTimes(1);
        });

        let responseSettled = false;
        void responsePromise.then(() => {
            responseSettled = true;
        });
        await Promise.resolve();
        expect(responseSettled).toBe(false);

        releaseAudit();
        const response = await responsePromise;

        expect(response.status).toBe(401);
        expect(issueAccessTokenMock).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.create).not.toHaveBeenCalled();
        expect(appendAuditBestEffortMock).toHaveBeenCalledTimes(1);
        expect(appendAuditBestEffortMock).toHaveBeenCalledWith({
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: 7,
            userId: 7,
            userEmail: "user@thainhf.org",
            ipAddress: "203.0.113.10",
            userAgent: "hybrid-login-test-agent",
            details: {
                metadata: {
                    method: "hybrid_login",
                    reason: "invalid_credentials_or_inactive",
                },
            },
        });
        expect(compareMock.mock.invocationCallOrder[0])
            .toBeLessThan(appendAuditBestEffortMock.mock.invocationCallOrder[0]);
        expect(appendAuditBestEffortMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ action: "LOGIN_SUCCESS" }),
        );
    });

    it.each([
        { status: "INACTIVE" as const, deletedAt: null, label: "inactive" },
        { status: "SUSPENDED" as const, deletedAt: null, label: "suspended" },
        {
            status: "ACTIVE" as const,
            deletedAt: new Date("2026-01-01T00:00:00.000Z"),
            label: "soft-deleted",
        },
    ])("rejects a linked $label employee before issuing credentials", async ({
        status,
        deletedAt,
    }) => {
        prismaMock.user.findUnique.mockResolvedValue(buildUser({ status, deletedAt }));

        const response = await hybridLoginRoute(buildRequest());

        expect(response.status).toBe(401);
        expect(issueAccessTokenMock).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.create).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("preserves login for a user intentionally not linked to an employee", async () => {
        prismaMock.user.findUnique.mockResolvedValue(buildUser(null));

        const response = await hybridLoginRoute(buildRequest());

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.create).toHaveBeenCalledTimes(1);
        expect(response.headers.get("set-cookie")).toContain(HYBRID_ACCESS_COOKIE_NAME);
    });
});
