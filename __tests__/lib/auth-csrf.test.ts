// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import {
    assertTrustedMutationRequest,
    CSRF_ENFORCEMENT_MODE_ENV,
    getCsrfEnforcementMode,
    TRUSTED_MUTATION_ROLLOUT,
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
        expect(assertTrustedMutationRequest(request, TRUSTED_MUTATION_ROLLOUT)).toBeNull();
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

describe("CSRF_ENFORCEMENT_MODE rollout switch", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    function untrustedRequest(headers: Record<string, string>): NextRequest {
        return new NextRequest("http://localhost/api/stock/requests?token=query-secret", {
            method: "POST",
            headers: { cookie: "__Host-nhf_access=secret-cookie", ...headers },
            body: JSON.stringify({ password: "body-secret" }),
        });
    }

    it.each([undefined, "", "enforce", "ENFORCE", "reprot", "off"])(
        "enforces for value %s",
        (value) => {
            if (value !== undefined) vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, value);
            expect(getCsrfEnforcementMode()).toBe("enforce");
        },
    );

    it.each(["report", " Report "])("reports for value %s", (value) => {
        vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, value);
        expect(getCsrfEnforcementMode()).toBe("report");
    });

    it.each([
        ["missing-origin", { "x-requested-with": "XMLHttpRequest" }, null],
        ["untrusted-origin", { origin: "https://evil.example.com", "x-requested-with": "XMLHttpRequest" }, "evil.example.com"],
        ["missing-ajax-header", { origin: "http://localhost" }, "localhost"],
    ] as const)(
        "report mode lets a rollout route through on %s and logs a sanitized warning",
        (check, headers, originHost) => {
            vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, "report");
            const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

            const response = assertTrustedMutationRequest(untrustedRequest(headers), TRUSTED_MUTATION_ROLLOUT);

            expect(response).toBeNull();
            expect(warn).toHaveBeenCalledOnce();
            expect(warn).toHaveBeenCalledWith(
                "[csrf] report mode: trusted mutation check failed; request allowed",
                { route: "/api/stock/requests", method: "POST", check, originHost },
            );
            const logged = JSON.stringify(warn.mock.calls);
            expect(logged).not.toContain("secret-cookie");
            expect(logged).not.toContain("query-secret");
            expect(logged).not.toContain("body-secret");
        },
    );

    it("report mode never relaxes routes that were guarded before the rollout", () => {
        vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, "report");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const response = assertTrustedMutationRequest(untrustedRequest({}));

        expect(response?.status).toBe(403);
        expect(warn).not.toHaveBeenCalled();
    });

    it("enforce mode rejects rollout routes without logging a report", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const response = assertTrustedMutationRequest(untrustedRequest({}), TRUSTED_MUTATION_ROLLOUT);

        expect(response?.status).toBe(403);
        expect(warn).not.toHaveBeenCalled();
    });

    it("withTrustedMutation calls the handler in report mode and short-circuits in enforce mode", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const handler = vi.fn(async (): Promise<NextResponse> => NextResponse.json({ ok: true }));
        const route = withTrustedMutation(handler, TRUSTED_MUTATION_ROLLOUT);

        expect((await route(untrustedRequest({}))).status).toBe(403);
        expect(handler).not.toHaveBeenCalled();

        vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, "report");
        expect((await route(untrustedRequest({}))).status).toBe(200);
        expect(handler).toHaveBeenCalledOnce();
    });
});

