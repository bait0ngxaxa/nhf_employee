import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("security headers config", () => {
    it("applies baseline browser security headers to every route", async () => {
        expect(nextConfig.headers).toBeDefined();

        const routes = await nextConfig.headers?.();
        const allRoutes = routes?.find((route) => route.source === "/:path*");
        const headerMap = new Map(
            allRoutes?.headers.map((header) => [header.key, header.value]),
        );

        expect(headerMap.get("X-Frame-Options")).toBe("DENY");
        expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
        expect(headerMap.get("Referrer-Policy")).toBe(
            "strict-origin-when-cross-origin",
        );
        expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
        expect(headerMap.get("Strict-Transport-Security")).toContain(
            "max-age=31536000",
        );
        expect(headerMap.get("Content-Security-Policy")).toContain(
            "default-src 'self'",
        );
        expect(headerMap.get("Content-Security-Policy")).toContain(
            "object-src 'none'",
        );
        expect(headerMap.get("Content-Security-Policy")).toContain(
            "base-uri 'self'",
        );
        expect(headerMap.get("Content-Security-Policy")).toContain(
            "form-action 'self'",
        );
        expect(headerMap.get("Content-Security-Policy")).toContain(
            "frame-ancestors 'none'",
        );
        expect(headerMap.get("Content-Security-Policy")).not.toContain(
            "'unsafe-eval'",
        );
    });

    it("keeps production LIFF connections narrowly scoped", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();

        const { default: productionConfig } = await import("@/next.config");
        const routes = await productionConfig.headers?.();
        const allRoutes = routes?.find((route) => route.source === "/:path*");
        const csp = allRoutes?.headers.find(
            (header) => header.key === "Content-Security-Policy",
        )?.value;

        expect(csp).toContain(
            "connect-src 'self' https://cloudflareinsights.com https://api.line.me https://access.line.me https://liff.line.me",
        );
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self' 'unsafe-inline'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("upgrade-insecure-requests");
        expect(csp).not.toContain("connect-src https:");
        expect(csp).not.toContain("https://*.line.me");
        expect(csp).not.toContain("'unsafe-eval'");
    });
});
