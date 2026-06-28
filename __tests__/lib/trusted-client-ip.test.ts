import { describe, expect, it } from "vitest";

import { getTrustedClientIp } from "@/lib/trusted-client-ip";

function buildHeaders(values: Record<string, string>): Headers {
    const headers = new Headers();
    for (const [key, value] of Object.entries(values)) {
        headers.set(key, value);
    }
    return headers;
}

describe("trusted client IP", () => {
    it("uses Cloudflare client IP header", () => {
        const headers = buildHeaders({
            "cf-connecting-ip": "203.0.113.10",
            "x-forwarded-for": "198.51.100.1",
        });

        expect(getTrustedClientIp(headers)).toBe("203.0.113.10");
    });

    it("ignores client-supplied forwarded headers", () => {
        const headers = buildHeaders({
            "x-forwarded-for": "198.51.100.1",
            "x-real-ip": "198.51.100.2",
        });

        expect(getTrustedClientIp(headers)).toBeNull();
    });

    it("rejects comma-separated or invalid IP values", () => {
        const headers = buildHeaders({
            "cf-connecting-ip": "203.0.113.10, 198.51.100.1",
            "true-client-ip": "not-an-ip",
        });

        expect(getTrustedClientIp(headers)).toBeNull();
    });
});
