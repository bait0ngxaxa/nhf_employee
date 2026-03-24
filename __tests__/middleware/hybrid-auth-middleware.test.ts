// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import middleware from "@/middleware";
import { issueAccessToken } from "@/lib/hybrid-auth-tokens";

function buildRequest(url: string, cookie?: string): NextRequest {
    return new NextRequest(url, {
        headers: cookie ? { cookie } : undefined,
    });
}

describe("hybrid auth middleware", () => {
    it("redirects unauthenticated user from protected route to /login", async () => {
        const request = buildRequest("http://localhost/dashboard");
        const response = await middleware(request);

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/login");
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

        const request = buildRequest("http://localhost/dashboard", `nhf_at=${token}`);
        const response = await middleware(request);

        expect(response.status).toBe(200);
    });
});
