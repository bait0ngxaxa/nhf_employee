import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

describe("rate-limit process-local state contract", () => {
    it("keeps Auth budgets independent across isolated module instances", async () => {
        vi.resetModules();
        const first = await import("@/lib/auth/rate-limit");
        vi.resetModules();
        const second = await import("@/lib/auth/rate-limit");
        const policy = {
            windowMs: 60 * 1000,
            maxAttemptsPerIdentity: 1,
            maxAttemptsPerIp: 1,
        } as const;
        const input = {
            scope: "login",
            identity: "isolated@thainhf.org",
            ipAddress: "203.0.113.10",
        };

        first.recordAuthAttempt(input, policy);

        expect(first.isAuthRateLimited(input, policy)).toBe(true);
        expect(second.isAuthRateLimited(input, policy)).toBe(false);

        first.resetAuthRateLimit();
        second.resetAuthRateLimit();
    });

    it("keeps mutation budgets independent across isolated module instances", async () => {
        vi.resetModules();
        const first = await import("@/lib/security/mutation-rate-limit");
        vi.resetModules();
        const second = await import("@/lib/security/mutation-rate-limit");
        const policy = first.AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES[
            "stock-request-create"
        ];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            expect(
                first.enforceAuthenticatedMutationRateLimit(
                    "stock-request-create",
                    "isolated-user",
                ),
            ).toBeNull();
        }

        expect(
            first.enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                "isolated-user",
            ),
        ).not.toBeNull();
        expect(
            second.enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                "isolated-user",
            ),
        ).toBeNull();

        first.resetMutationRateLimit();
        second.resetMutationRateLimit();
    });

    it("keeps the unknown pre-auth bucket isolated to each module instance", async () => {
        vi.resetModules();
        const first = await import("@/lib/security/mutation-rate-limit");
        vi.resetModules();
        const second = await import("@/lib/security/mutation-rate-limit");
        const request = new NextRequest("http://localhost/api/stock/requests", {
            method: "POST",
        });
        const policy = first.PRE_AUTH_IP_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            expect(
                first.enforcePreAuthIpRateLimit(request, "stock-request-create"),
            ).toBeNull();
        }

        expect(
            first.enforcePreAuthIpRateLimit(request, "stock-request-create"),
        ).not.toBeNull();
        expect(
            second.enforcePreAuthIpRateLimit(request, "stock-request-create"),
        ).toBeNull();

        first.resetMutationRateLimit();
        second.resetMutationRateLimit();
    });
});
