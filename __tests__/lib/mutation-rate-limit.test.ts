import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
    AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES,
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
    MAX_MUTATION_RATE_LIMIT_ENTRIES,
    PRE_AUTH_IP_RATE_LIMIT_POLICIES,
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

    it("blocks a pre-auth flood from the same IP before authentication", async () => {
        const request = createRequest("203.0.113.10");
        const policy =
            PRE_AUTH_IP_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            expect(
                enforcePreAuthIpRateLimit(request, "stock-request-create"),
            ).toBeNull();
        }

        const response = enforcePreAuthIpRateLimit(
            request,
            "stock-request-create",
        );

        expect(response?.status).toBe(429);
        expect(response?.headers.get("Retry-After")).toBe("900");
        expect(response?.headers.get("X-RateLimit-Limit")).toBe(
            String(policy.maxRequests),
        );
        await expect(response?.json()).resolves.toEqual({
            error: "มีคำขอมากเกินไป กรุณาลองใหม่ภายหลัง",
        });
    });

    it("keeps pre-auth scopes and trusted client IPs isolated", () => {
        const firstClient = createRequest("203.0.113.10");
        const secondClient = createRequest("203.0.113.11");
        const policy =
            PRE_AUTH_IP_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            enforcePreAuthIpRateLimit(firstClient, "stock-request-create");
        }

        expect(
            enforcePreAuthIpRateLimit(firstClient, "stock-request-create"),
        ).not.toBeNull();
        expect(
            enforcePreAuthIpRateLimit(secondClient, "stock-request-create"),
        ).toBeNull();
        expect(
            enforcePreAuthIpRateLimit(firstClient, "stock-request-cancel"),
        ).toBeNull();
    });

    it.each([
        ["leave-request-create", 10],
        ["stock-request-create", 10],
        ["stock-request-issue", 30],
        ["stock-request-cancel", 20],
        ["stock-adjust", 30],
    ] as const)(
        "does not share the %s authenticated quota between users behind the same IP",
        (scope, expectedLimit) => {
            const policy =
                AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES[scope];
            expect(policy.maxRequests).toBe(expectedLimit);

            for (let index = 0; index < policy.maxRequests; index += 1) {
                expect(
                    enforceAuthenticatedMutationRateLimit(scope, 101),
                ).toBeNull();
            }

            expect(
                enforceAuthenticatedMutationRateLimit(scope, 101),
            ).not.toBeNull();
            expect(
                enforceAuthenticatedMutationRateLimit(scope, 102),
            ).toBeNull();
        },
    );

    it("allows authenticated requests again after the fixed window expires", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
        const policy =
            AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES[
                "stock-request-create"
            ];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                101,
            );
        }
        expect(
            enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                101,
            ),
        ).not.toBeNull();

        vi.advanceTimersByTime(policy.windowMs);

        expect(
            enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                101,
            ),
        ).toBeNull();
    });

    it("consumes a single authenticated key synchronously at the exact boundary", async () => {
        const policy = AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES[
            "stock-request-create"
        ];

        const responses = await Promise.all(
            Array.from({ length: policy.maxRequests + 3 }, () =>
                Promise.resolve(
                    enforceAuthenticatedMutationRateLimit(
                        "stock-request-create",
                        "parallel-user-0",
                    ),
                ),
            ),
        );

        expect(responses.slice(0, policy.maxRequests).every((value) => value === null))
            .toBe(true);
        expect(responses.slice(policy.maxRequests).every((value) => value !== null))
            .toBe(true);
    });

    it("places missing client IPs in one shared unknown bucket", () => {
        const request = new NextRequest("http://localhost/api/stock/requests", {
            method: "POST",
        });
        const policy = PRE_AUTH_IP_RATE_LIMIT_POLICIES["stock-request-create"];

        for (let index = 0; index < policy.maxRequests; index += 1) {
            expect(
                enforcePreAuthIpRateLimit(request, "stock-request-create"),
            ).toBeNull();
        }

        expect(
            enforcePreAuthIpRateLimit(request, "stock-request-create"),
        ).not.toBeNull();
    });

    it("fails closed at the bounded entry capacity and cleans expired entries first", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));

        let currentIp = "2001:db8::1";
        const request = {
            headers: {
                get(name: string): string | null {
                    return name.toLowerCase() === "cf-connecting-ip"
                        ? currentIp
                        : null;
                },
            },
        } as unknown as NextRequest;

        for (let index = 0; index < MAX_MUTATION_RATE_LIMIT_ENTRIES; index += 1) {
            currentIp = `2001:db8::${(index + 1).toString(16)}`;
            expect(
                enforcePreAuthIpRateLimit(request, "stock-request-create"),
            ).toBeNull();
        }

        expect(
            enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                "unrelated-user",
            ),
        ).not.toBeNull();

        vi.advanceTimersByTime(15 * 60 * 1000);

        expect(
            enforceAuthenticatedMutationRateLimit(
                "stock-request-create",
                "capacity-user-after-expiry",
            ),
        ).toBeNull();
    });
});
