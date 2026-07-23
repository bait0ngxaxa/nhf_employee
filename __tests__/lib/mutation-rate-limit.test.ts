import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
    enforceMutationRateLimit,
    MUTATION_RATE_LIMIT_POLICIES,
    resetMutationRateLimit,
} from "@/lib/security/mutation-rate-limit";

function createRequest(ipAddress: string): NextRequest {
    return new NextRequest("http://localhost/api/stock/requests", {
        method: "POST",
        headers: { "cf-connecting-ip": ipAddress },
    });
}

describe("mutation rate limit", () => {
    beforeEach(() => {
        resetMutationRateLimit();
        vi.useRealTimers();
    });

    it("blocks new idempotency keys from the same client after the create limit", async () => {
        const request = createRequest("203.0.113.10");
        const policy = MUTATION_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            expect(
                enforceMutationRateLimit(request, "stock-request-create"),
            ).toBeNull();
        }

        const response = enforceMutationRateLimit(
            request,
            "stock-request-create",
        );

        expect(response?.status).toBe(429);
        expect(response?.headers.get("Retry-After")).toBe("60");
        expect(response?.headers.get("X-RateLimit-Limit")).toBe(
            String(policy.maxRequests),
        );
        await expect(response?.json()).resolves.toEqual({
            error: "มีคำขอมากเกินไป กรุณาลองใหม่ภายหลัง",
        });
    });

    it("keeps scopes and trusted client IPs isolated", () => {
        const firstClient = createRequest("203.0.113.10");
        const secondClient = createRequest("203.0.113.11");
        const policy = MUTATION_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            enforceMutationRateLimit(firstClient, "stock-request-create");
        }

        expect(
            enforceMutationRateLimit(firstClient, "stock-request-create"),
        ).not.toBeNull();
        expect(
            enforceMutationRateLimit(secondClient, "stock-request-create"),
        ).toBeNull();
        expect(
            enforceMutationRateLimit(firstClient, "stock-request-cancel"),
        ).toBeNull();
    });

    it("allows requests again after the fixed window expires", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
        const request = createRequest("203.0.113.10");
        const policy = MUTATION_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            enforceMutationRateLimit(request, "stock-request-create");
        }
        expect(
            enforceMutationRateLimit(request, "stock-request-create"),
        ).not.toBeNull();

        vi.advanceTimersByTime(policy.windowMs);

        expect(
            enforceMutationRateLimit(request, "stock-request-create"),
        ).toBeNull();
    });
});
