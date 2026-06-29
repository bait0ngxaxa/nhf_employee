// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { buildPublicUrl, getPublicOrigin } from "@/lib/network/public-url";

describe("public url helpers", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("uses the current request origin in development", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://approve.example.com");

        const request = new NextRequest("http://localhost:3000/dashboard");

        expect(getPublicOrigin(request)).toBe("http://localhost:3000");
    });

    it("uses forwarded request origin in development when env points to localhost", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("PUBLIC_APPROVE_URL", "http://localhost:3000");

        const request = new NextRequest("http://localhost:3000/dashboard", {
            headers: {
                "x-forwarded-host": "approve.example.com",
                "x-forwarded-proto": "https",
            },
        });

        expect(buildPublicUrl("/login", request).toString()).toBe("https://approve.example.com/login");
    });

    it("uses configured public origin in production", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://approve.example.com");

        const request = new NextRequest("http://localhost:3000/dashboard");

        expect(buildPublicUrl("/login", request).toString()).toBe("https://approve.example.com/login");
    });

    it("uses forwarded host when production env is not configured", () => {
        vi.stubEnv("NODE_ENV", "production");

        const request = new NextRequest("http://localhost:3000/dashboard", {
            headers: {
                "x-forwarded-host": "approve.example.com",
                "x-forwarded-proto": "https",
            },
        });

        expect(buildPublicUrl("/login", request).toString()).toBe("https://approve.example.com/login");
    });

    it("ignores localhost env values in production when forwarded host is available", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("PUBLIC_APPROVE_URL", "http://localhost:3000");

        const request = new NextRequest("http://localhost:3000/dashboard", {
            headers: {
                "x-forwarded-host": "approve.example.com",
                "x-forwarded-proto": "https",
            },
        });

        expect(buildPublicUrl("/login", request).toString()).toBe("https://approve.example.com/login");
    });

    it("does not fallback to localhost in production", () => {
        vi.stubEnv("NODE_ENV", "production");

        const request = new NextRequest("http://localhost:3000/dashboard");

        expect(() => getPublicOrigin(request)).toThrow("PUBLIC_APPROVE_URL");
    });
});
