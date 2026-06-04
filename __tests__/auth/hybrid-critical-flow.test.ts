// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
        authRefreshToken: {
            create: vi.fn(),
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: prismaMock,
}));

import middleware from "@/middleware";
import { POST as logoutAllRoute } from "@/app/api/auth/logout-all/route";
import { issueAccessToken } from "@/lib/hybrid-auth-tokens";

describe("Hybrid critical flow", () => {
    const csrfHeaders = {
        origin: "http://localhost",
        "x-requested-with": "XMLHttpRequest",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.AUTH_ACCESS_TOKEN_SECRET = "critical-flow-test-secret";

        prismaMock.user.findUnique.mockResolvedValue({
            id: 1,
            role: "ADMIN",
            isActive: true,
            email: "admin@test.com",
        });

        prismaMock.authRefreshToken.create.mockResolvedValue({ id: "rt_1" });
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 2 });
    });

    it("valid hybrid access token can access /dashboard", async () => {
        const accessToken = await issueAccessToken({
            userId: 1,
            role: "ADMIN",
            sessionId: "family_1",
            tokenVersion: 1,
        });
        const dashboardRequest = new NextRequest("http://localhost/dashboard", {
            headers: { cookie: `nhf_at=${accessToken}` },
        });

        const middlewareResponse = await middleware(dashboardRequest);
        expect(middlewareResponse.status).toBe(200);
    });

    it("logout-all then protected route must redirect to /login", async () => {
        const accessToken = await issueAccessToken({
            userId: 1,
            role: "ADMIN",
            sessionId: "family_1",
            tokenVersion: 1,
        });

        const logoutAllRequest = new NextRequest("http://localhost/api/auth/logout-all", {
            method: "POST",
            headers: { ...csrfHeaders, cookie: `nhf_at=${accessToken}` },
        });

        const logoutAllResponse = await logoutAllRoute(logoutAllRequest);
        expect(logoutAllResponse.status).toBe(200);

        const protectedRequest = new NextRequest("http://localhost/dashboard");
        const middlewareResponse = await middleware(protectedRequest);
        expect(middlewareResponse.status).toBe(307);
        expect(middlewareResponse.headers.get("location")).toBe("http://localhost/login");
    });
});
