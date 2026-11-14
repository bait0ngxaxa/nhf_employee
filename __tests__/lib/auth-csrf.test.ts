// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";

import {
    assertTrustedMutationRequest,
    withTrustedMutation,
} from "@/lib/auth/csrf";

describe("auth csrf guard", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("rejects when origin or ajax header is missing", () => {
        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
        });

        const response = assertTrustedMutationRequest(request);
        expect(response?.status).toBe(403);
    });

    it("allows trusted same-origin ajax requests", () => {
        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: {
                origin: "http://localhost",
                "x-requested-with": "XMLHttpRequest",
            },
        });

        const response = assertTrustedMutationRequest(request);
        expect(response).toBeNull();
    });

    it("allows requests when origin matches PUBLIC_APPROVE_URL behind reverse proxy", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://approve.example.com");

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: {
                origin: "https://approve.example.com",
                "x-requested-with": "XMLHttpRequest",
            },
        });

        const response = assertTrustedMutationRequest(request);
        expect(response).toBeNull();
    });

    it("rejects when origin matches neither nextUrl nor PUBLIC_APPROVE_URL", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://approve.example.com");

        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: {
                origin: "https://evil.example.com",
                "x-requested-with": "XMLHttpRequest",
            },
        });

        const response = assertTrustedMutationRequest(request);
        expect(response?.status).toBe(403);
    });

    it.each([
        // cloudflared forwards to the loopback origin...
        "http://127.0.0.1:3000/api/leave/request",
        // ...and Next may also derive the URL from Host over plain HTTP.
        "http://nhfapp.org/api/leave/request",
    ])("trusts the production browser Origin via PUBLIC_APPROVE_URL behind the tunnel (%s)", (url) => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://nhfapp.org");

        const request = new NextRequest(url, {
            method: "POST",
            headers: {
                host: "nhfapp.org",
                origin: "https://nhfapp.org",
                "x-forwarded-proto": "https",
                "x-requested-with": "XMLHttpRequest",
            },
        });

        expect(request.nextUrl.origin).not.toBe("https://nhfapp.org");
        expect(assertTrustedMutationRequest(request)).toBeNull();
    });

    it("rejects the production tunnel request when PUBLIC_APPROVE_URL is missing", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "");

        const request = new NextRequest("http://127.0.0.1:3000/api/leave/request", {
            method: "POST",
            headers: {
                host: "nhfapp.org",
                origin: "https://nhfapp.org",
                "x-requested-with": "XMLHttpRequest",
            },
        });

        expect(assertTrustedMutationRequest(request)?.status).toBe(403);
    });

    it("rejects a same-site sibling subdomain Origin", () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://nhfapp.org");

        const request = new NextRequest("http://127.0.0.1:3000/api/leave/request", {
            method: "POST",
            headers: { origin: "https://evil.nhfapp.org", "x-requested-with": "XMLHttpRequest" },
        });

        expect(assertTrustedMutationRequest(request)?.status).toBe(403);
    });
});

describe("trusted mutation wrapper", () => {
    const untrustedHeaders: Record<string, string>[] = [
        { "x-requested-with": "XMLHttpRequest" },
        { origin: "https://evil.example.com", "x-requested-with": "XMLHttpRequest" },
        { origin: "http://localhost" },
    ];

    it.each(untrustedHeaders)("rejects untrusted headers before calling the handler: %j", async (headers) => {
        const handler = vi.fn(async (): Promise<NextResponse> => NextResponse.json({ ok: true }));
        const response = await withTrustedMutation(handler)(new NextRequest("http://localhost/api/test", {
            method: "POST",
            headers,
        }));

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: AUTH_ERROR_MESSAGES.forbidden });
        expect(handler).not.toHaveBeenCalled();
    });

    it("passes a trusted request and route context through to the handler", async () => {
        const request = new NextRequest("http://localhost/api/test", {
            method: "POST",
            headers: { origin: "http://localhost", "x-requested-with": "XMLHttpRequest" },
        });
        const context = { params: Promise.resolve({ id: "1" }) };
        const expected = NextResponse.json({ ok: true });
        const handler = vi.fn(async (_request: NextRequest, _context: typeof context): Promise<NextResponse> => expected);

        expect(await withTrustedMutation(handler)(request, context)).toBe(expected);
        expect(handler).toHaveBeenCalledExactlyOnceWith(request, context);
    });
});
