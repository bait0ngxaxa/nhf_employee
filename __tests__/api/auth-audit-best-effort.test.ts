// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as hybridLoginRoute } from "@/app/api/auth/hybrid-login/route";
import { resetAuthRateLimit } from "@/lib/auth/rate-limit";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";

const {
    compareMock,
    issueAccessTokenMock,
    prismaMock,
} = vi.hoisted(() => ({
    compareMock: vi.fn(),
    issueAccessTokenMock: vi.fn(),
    prismaMock: {
        auditLog: { create: vi.fn() },
        user: { findUnique: vi.fn() },
        authRefreshToken: { create: vi.fn() },
    },
}));

vi.mock("bcryptjs", () => ({
    default: { compare: compareMock },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/auth/hybrid/tokens", () => ({
    buildRefreshTokenRecord: vi.fn(() => ({
        rawToken: "refresh-token",
        record: {
            userId: 7,
            tokenHash: "refresh-token-hash",
            familyId: "family-1",
            expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            userAgent: "best-effort-test-agent",
            ipAddress: "203.0.113.50",
        },
    })),
    issueAccessToken: issueAccessTokenMock,
    getAccessTokenTtlSeconds: vi.fn(() => 900),
    getRefreshTokenTtlSeconds: vi.fn(() => 2_592_000),
}));

function buildRequest(): NextRequest {
    return new NextRequest("http://localhost/api/auth/hybrid-login", {
        method: "POST",
        headers: {
            origin: "http://localhost",
            "x-requested-with": "XMLHttpRequest",
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.50",
            "x-forwarded-for": "198.51.100.50",
            "user-agent": "best-effort-test-agent",
        },
        body: JSON.stringify({
            email: "user@thainhf.org",
            password: "secret1",
        }),
    });
}

function buildUser() {
    return {
        id: 7,
        email: "user@thainhf.org",
        name: "Test User",
        password: "hashed-password",
        role: "USER",
        isActive: true,
        deletedAt: null,
        tokenVersion: 1,
        employee: null,
    };
}

describe("Auth results with Audit best-effort persistence failure", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAuthRateLimit();
        resetMutationRateLimit();
        compareMock.mockResolvedValue(true);
        issueAccessTokenMock.mockResolvedValue("access-token");
        prismaMock.authRefreshToken.create.mockResolvedValue({ id: "rt-1" });
        prismaMock.auditLog.create.mockRejectedValue(
            new Error("audit persistence unavailable"),
        );
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps a successful login successful when Audit persistence fails", async () => {
        prismaMock.user.findUnique.mockResolvedValue(buildUser());

        const response = await hybridLoginRoute(buildRequest());

        expect(response.status).toBe(200);
        expect(prismaMock.authRefreshToken.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LOGIN_SUCCESS",
                entityType: "User",
                entityId: 7,
                userId: 7,
                userEmail: "user@thainhf.org",
                ipAddress: "203.0.113.50",
                userAgent: "best-effort-test-agent",
            }),
        });
    });

    it("keeps a failed login response unchanged when Audit persistence fails", async () => {
        compareMock.mockResolvedValue(false);
        prismaMock.user.findUnique.mockResolvedValue(buildUser());

        const response = await hybridLoginRoute(buildRequest());

        expect(response.status).toBe(401);
        expect(prismaMock.authRefreshToken.create).not.toHaveBeenCalled();
        expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: "LOGIN_FAILED",
                entityType: "User",
                entityId: 7,
                userId: 7,
                userEmail: "user@thainhf.org",
                ipAddress: "203.0.113.50",
                userAgent: "best-effort-test-agent",
            }),
        });
    });
});
