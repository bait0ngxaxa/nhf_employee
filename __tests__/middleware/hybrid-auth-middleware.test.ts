// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import middleware from "@/middleware";
import { issueAccessToken } from "@/lib/auth/hybrid/tokens";
import {
    HYBRID_ACCESS_COOKIE_NAME,
    HYBRID_REFRESH_COOKIE_NAME,
} from "@/lib/auth/hybrid/constants";

function buildRequest(url: string, cookie?: string): NextRequest {
    return new NextRequest(url, {
        headers: cookie ? { cookie } : undefined,
    });
}

describe("hybrid auth middleware", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("redirects unauthenticated user from protected route to /login", async () => {
        const request = buildRequest("http://localhost/dashboard");
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/login");
    });

    it("redirects unauthenticated user from stock dashboard route to /login", async () => {
        const request = buildRequest(
            "http://localhost/dashboard?tab=stock&stockTab=browse",
        );
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/login");
    });

    it("redirects protected route with only refresh cookie to refresh bridge", async () => {
        const request = buildRequest("http://localhost/dashboard", `${HYBRID_REFRESH_COOKIE_NAME}=present`);
        const response = await middleware(request);
        const location = response.headers.get("location");

        expect(response.status).toBe(307);
        expect(location).toBe("http://localhost/auth/refresh?next=%2Fdashboard");
    });

    it("preserves protected route query when redirecting to refresh bridge", async () => {
        const request = buildRequest(
            "http://localhost/dashboard?tab=stock&stockTab=browse",
            `${HYBRID_REFRESH_COOKIE_NAME}=present`,
        );
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
            "http://localhost/auth/refresh?next=%2Fdashboard%3Ftab%3Dstock%26stockTab%3Dbrowse",
        );
    });

    it("allows access to public route without authentication", async () => {
        const request = buildRequest("http://localhost/login");
        const response = await middleware(request);

        expect(response.status).toBe(200);
    });

    it("allows protected route when valid hybrid access token exists", async () => {
        process.env.AUTH_ACCESS_TOKEN_SECRET = "middleware-test-secret";
        const token = await issueAccessToken({
            userId: 1,
            role: "ADMIN",
            sessionId: "family-1",
            tokenVersion: 1,
        });

        const request = buildRequest("http://localhost/dashboard", `${HYBRID_ACCESS_COOKIE_NAME}=${token}`);
        const response = await middleware(request);

        expect(response.status).toBe(200);
    });

    it("allows stock dashboard route when valid hybrid access token exists", async () => {
        process.env.AUTH_ACCESS_TOKEN_SECRET = "middleware-test-secret";
        const token = await issueAccessToken({
            userId: 1,
            role: "ADMIN",
            sessionId: "family-1",
            tokenVersion: 1,
        });

        const request = buildRequest(
            "http://localhost/dashboard?tab=stock&stockTab=admin-requests",
            `${HYBRID_ACCESS_COOKIE_NAME}=${token}`,
        );
        const response = await middleware(request);

        expect(response.status).toBe(200);
    });

    it("redirects authenticated user away from /login to /dashboard", async () => {
        process.env.AUTH_ACCESS_TOKEN_SECRET = "middleware-test-secret";
        const token = await issueAccessToken({
            userId: 1,
            role: "USER",
            sessionId: "family-2",
            tokenVersion: 1,
        });

        const request = buildRequest("http://localhost/login", `${HYBRID_ACCESS_COOKIE_NAME}=${token}`);
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    });

    it("redirects production requests to the configured public domain", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://approve.example.com");

        const request = buildRequest("http://localhost:3000/dashboard");
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://approve.example.com/login");
    });

    it("redirects forwarded requests to the forwarded public domain when env points to localhost", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("PUBLIC_APPROVE_URL", "http://localhost:3000");

        const request = new NextRequest("http://localhost:3000/dashboard", {
            headers: {
                "x-forwarded-host": "approve.example.com",
                "x-forwarded-proto": "https",
            },
        });
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://approve.example.com/login");
    });
});
