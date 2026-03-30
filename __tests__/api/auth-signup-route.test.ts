// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { resetSignupRateLimit } from "@/lib/auth-signup-rate-limit";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        authRefreshToken: {
            create: vi.fn(),
        },
        employee: {
            findUnique: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

vi.mock("bcryptjs", () => ({
    default: {
        hash: vi.fn(async () => "hashed-password"),
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: prismaMock,
}));

vi.mock("@/lib/hybrid-auth-tokens", async () => {
    const actual =
        await vi.importActual<typeof import("@/lib/hybrid-auth-tokens")>(
            "@/lib/hybrid-auth-tokens",
        );

    return {
        ...actual,
        buildRefreshTokenRecord: vi.fn(() => ({
            rawToken: "refresh-token",
            record: {
                userId: 7,
                tokenHash: "hash:refresh-token",
                familyId: "family-1",
                expiresAt: new Date("2030-01-01T00:00:00.000Z"),
                userAgent: "Vitest",
                ipAddress: "127.0.0.1",
            },
        })),
        issueAccessToken: vi.fn(async () => "access-token"),
    };
});

function buildRequest(
    body: Record<string, unknown>,
    headers?: Record<string, string>,
): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
        method: "POST",
        headers: {
            origin: "http://localhost",
            "x-requested-with": "XMLHttpRequest",
            "content-type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

describe("Auth signup route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetSignupRateLimit();
    });

    it("rejects signup without trusted mutation headers", async () => {
        const request = new NextRequest("http://localhost/api/auth/signup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        });

        const response = await signupRoute(request);

        expect(response.status).toBe(403);
    });

    it("returns 400 when signup payload is invalid", async () => {
        const response = await signupRoute(
            buildRequest({
                email: "user@gmail.com",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(400);
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it("creates user when signup payload is valid", async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique.mockResolvedValue({
            id: 10,
            firstName: "สมชาย",
            lastName: "ใจดี",
            user: null,
        });
        prismaMock.user.create.mockResolvedValue({
            id: 7,
            name: "สมชาย ใจดี",
            email: "user@thainhf.org",
            role: "USER",
            tokenVersion: 1,
        });
        prismaMock.authRefreshToken.create.mockResolvedValue({ id: "rt-1" });
        prismaMock.auditLog.create.mockResolvedValue({ id: 1 });

        const response = await signupRoute(
            buildRequest({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(201);
        expect(prismaMock.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: "user@thainhf.org",
                    role: "USER",
                }),
            }),
        );
        expect(prismaMock.authRefreshToken.create).toHaveBeenCalledTimes(1);
        expect(response.headers.get("set-cookie")).toContain("nhf_at=");
    });

    it("assigns ADMIN role for bootstrap admin email", async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique.mockResolvedValue({
            id: 11,
            firstName: "System",
            lastName: "Administrator",
            user: null,
        });
        prismaMock.user.create.mockResolvedValue({
            id: 8,
            name: "System Administrator",
            email: "admin@thainhf.org",
            role: "ADMIN",
            tokenVersion: 1,
        });
        prismaMock.authRefreshToken.create.mockResolvedValue({ id: "rt-2" });
        prismaMock.auditLog.create.mockResolvedValue({ id: 2 });

        const response = await signupRoute(
            buildRequest({
                email: "admin@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(201);
        expect(prismaMock.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: "admin@thainhf.org",
                    role: "ADMIN",
                }),
            }),
        );
    });

    it("returns 429 when signup attempts exceed limit", async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            email: "user@thainhf.org",
        });

        const requestBody = {
            email: "user@thainhf.org",
            password: "secret1",
            confirmPassword: "secret1",
        };

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await signupRoute(buildRequest(requestBody));
            expect(response.status).toBe(400);
        }

        const rateLimitedResponse = await signupRoute(buildRequest(requestBody));

        expect(rateLimitedResponse.status).toBe(429);
    });
});
