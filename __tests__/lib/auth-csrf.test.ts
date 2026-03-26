// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { assertTrustedMutationRequest } from "@/lib/auth-csrf";

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

    it("allows requests when origin matches NEXTAUTH_URL behind reverse proxy", () => {
        vi.stubEnv("NEXTAUTH_URL", "https://approve.example.com");

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

    it("rejects when origin matches neither nextUrl nor NEXTAUTH_URL", () => {
        vi.stubEnv("NEXTAUTH_URL", "https://approve.example.com");

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
});

