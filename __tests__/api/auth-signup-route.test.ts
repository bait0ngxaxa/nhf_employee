// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import type * as HybridAuthTokensModule from "@/lib/auth/hybrid/tokens";

import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { resetAuthRateLimit } from "@/lib/auth/rate-limit";

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
        $queryRaw: vi.fn(),
        $transaction: vi.fn(),
    },
}));

vi.mock("bcryptjs", () => ({
    default: {
        hash: vi.fn(async () => "hashed-password"),
    },
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: prismaMock,
}));

vi.mock("@/lib/auth/hybrid/tokens", async () => {
    const actual =
        await vi.importActual<typeof HybridAuthTokensModule>(
            "@/lib/auth/hybrid/tokens",
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
        resetAuthRateLimit();
        prismaMock.user.findUnique.mockReset();
        prismaMock.user.create.mockReset();
        prismaMock.employee.findUnique.mockReset();
        prismaMock.auditLog.create.mockReset();
        prismaMock.$queryRaw.mockReset();
        prismaMock.$transaction.mockReset();
        prismaMock.$queryRaw.mockResolvedValue([]);
        prismaMock.$transaction.mockImplementation(async (operation) => {
            if (typeof operation === "function") {
                return operation(prismaMock);
            }
            return Promise.all(operation);
        });
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
            email: "user@thainhf.org",
            status: "ACTIVE",
            deletedAt: null,
            user: null,
        });
        prismaMock.user.create.mockResolvedValue({
            id: 7,
            name: "สมชาย ใจดี",
            email: "user@thainhf.org",
            role: "USER",
            tokenVersion: 1,
        });
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
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prismaMock.employee.findUnique).toHaveBeenNthCalledWith(2, {
            where: { id: 10 },
            select: expect.objectContaining({ email: true }),
        });
        expect(prismaMock.authRefreshToken.create).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("assigns ADMIN role for bootstrap admin email", async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique.mockResolvedValue({
            id: 11,
            firstName: "System",
            lastName: "Administrator",
            email: "admin@thainhf.org",
            status: "ACTIVE",
            deletedAt: null,
            user: null,
        });
        prismaMock.user.create.mockResolvedValue({
            id: 8,
            name: "System Administrator",
            email: "admin@thainhf.org",
            role: "ADMIN",
            tokenVersion: 1,
        });
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

    it("returns a generic conflict when a concurrent signup violates a unique constraint", async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique.mockResolvedValue({
            id: 10,
            firstName: "สมชาย",
            lastName: "ใจดี",
            email: "user@thainhf.org",
            status: "ACTIVE",
            deletedAt: null,
            user: null,
        });
        prismaMock.user.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
                code: "P2002",
                clientVersion: "6.19.3",
                meta: { target: ["email"] },
            }),
        );

        const response = await signupRoute(
            buildRequest({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "บัญชีนี้ถูกลงทะเบียนแล้ว",
        });
    });

    it.each([
        { status: "INACTIVE", deletedAt: null, label: "inactive" },
        { status: "SUSPENDED", deletedAt: null, label: "suspended" },
        {
            status: "ACTIVE",
            deletedAt: new Date("2026-01-01T00:00:00.000Z"),
            label: "soft-deleted",
        },
    ])("rejects signup for a $label employee", async ({ status, deletedAt }) => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique.mockResolvedValue({
            id: 10,
            firstName: "Lifecycle",
            lastName: "Blocked",
            email: "user@thainhf.org",
            status,
            deletedAt,
            user: null,
        });

        const response = await signupRoute(
            buildRequest({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("does not let the bootstrap admin email bypass employee lifecycle", async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique.mockResolvedValue({
            id: 11,
            firstName: "System",
            lastName: "Administrator",
            email: "admin@thainhf.org",
            status: "INACTIVE",
            deletedAt: null,
            user: null,
        });

        const response = await signupRoute(
            buildRequest({
                email: "admin@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it.each([
        { status: "INACTIVE", deletedAt: null, label: "inactive" },
        { status: "SUSPENDED", deletedAt: null, label: "suspended" },
        {
            status: "ACTIVE",
            deletedAt: new Date("2026-01-01T00:00:00.000Z"),
            label: "soft-deleted",
        },
    ])(
        "rejects when an initially active employee becomes $label before the locked reload",
        async ({ status, deletedAt }) => {
            const initialEmployee = {
                id: 10,
                firstName: "Lifecycle",
                lastName: "Changed",
                email: "user@thainhf.org",
                status: "ACTIVE",
                deletedAt: null,
                user: null,
            };
            prismaMock.user.findUnique.mockResolvedValue(null);
            prismaMock.employee.findUnique
                .mockResolvedValueOnce(initialEmployee)
                .mockResolvedValueOnce({
                    ...initialEmployee,
                    status,
                    deletedAt,
                });

            const response = await signupRoute(
                buildRequest({
                    email: "user@thainhf.org",
                    password: "secret1",
                    confirmPassword: "secret1",
                }),
            );

            expect(response.status).toBe(400);
            expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
            expect(prismaMock.user.create).not.toHaveBeenCalled();
        },
    );

    it("rejects when the employee email changes before the locked reload", async () => {
        const initialEmployee = {
            id: 10,
            firstName: "Identity",
            lastName: "Changed",
            email: "user@thainhf.org",
            status: "ACTIVE",
            deletedAt: null,
            user: null,
        };
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique
            .mockResolvedValueOnce(initialEmployee)
            .mockResolvedValueOnce({
                ...initialEmployee,
                email: "changed@thainhf.org",
            });

        const response = await signupRoute(
            buildRequest({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("rejects when the employee is linked by the time of the locked reload", async () => {
        const initialEmployee = {
            id: 10,
            firstName: "Already",
            lastName: "Linked",
            email: "user@thainhf.org",
            status: "ACTIVE",
            deletedAt: null,
            user: null,
        };
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique
            .mockResolvedValueOnce(initialEmployee)
            .mockResolvedValueOnce({
                ...initialEmployee,
                user: { id: 99 },
            });

        const response = await signupRoute(
            buildRequest({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("does not let bootstrap admin eligibility become stale before creation", async () => {
        const initialEmployee = {
            id: 11,
            firstName: "System",
            lastName: "Administrator",
            email: "admin@thainhf.org",
            status: "ACTIVE",
            deletedAt: null,
            user: null,
        };
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.employee.findUnique
            .mockResolvedValueOnce(initialEmployee)
            .mockResolvedValueOnce({
                ...initialEmployee,
                status: "INACTIVE",
            });

        const response = await signupRoute(
            buildRequest({
                email: "admin@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            }),
        );

        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
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
