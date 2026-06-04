import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

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
});
