import { type NextRequest, NextResponse } from "next/server";

import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";

interface RateLimitEntry {
    count: number;
    expiresAt: number;
}

interface MutationRateLimitPolicy {
    windowMs: number;
    maxRequests: number;
}

export type PreAuthRateLimitScope =
    | "auth-login"
    | "auth-refresh"
    | "stock-adjust"
    | "stock-request-cancel"
    | "stock-request-create"
    | "stock-request-issue";

export type AuthenticatedMutationRateLimitScope = Exclude<
    PreAuthRateLimitScope,
    "auth-login" | "auth-refresh"
>;

export const PRE_AUTH_IP_RATE_LIMIT_POLICIES = {
    "auth-login": { windowMs: 15 * 60 * 1000, maxRequests: 300 },
    "auth-refresh": { windowMs: 15 * 60 * 1000, maxRequests: 120 },
    "stock-adjust": { windowMs: 15 * 60 * 1000, maxRequests: 300 },
    "stock-request-cancel": { windowMs: 15 * 60 * 1000, maxRequests: 300 },
    "stock-request-create": { windowMs: 15 * 60 * 1000, maxRequests: 300 },
    "stock-request-issue": { windowMs: 15 * 60 * 1000, maxRequests: 300 },
} as const satisfies Record<PreAuthRateLimitScope, MutationRateLimitPolicy>;

export const AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES = {
    "stock-adjust": { windowMs: 60 * 1000, maxRequests: 30 },
    "stock-request-cancel": { windowMs: 60 * 1000, maxRequests: 20 },
    "stock-request-create": { windowMs: 60 * 1000, maxRequests: 10 },
    "stock-request-issue": { windowMs: 60 * 1000, maxRequests: 30 },
} as const satisfies Record<
    AuthenticatedMutationRateLimitScope,
    MutationRateLimitPolicy
>;

const rateLimitEntries = new Map<string, RateLimitEntry>();
const UNKNOWN_CLIENT = "unknown";
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_RATE_LIMIT_ENTRIES = 50_000;
let lastCleanupAt = 0;

function buildPreAuthIpKey(
    request: NextRequest,
    scope: PreAuthRateLimitScope,
): string {
    const clientIp = getTrustedClientIp(request.headers) ?? UNKNOWN_CLIENT;
    return `pre-auth:${scope}:ip:${clientIp}`;
}

function buildAuthenticatedPrincipalKey(
    scope: AuthenticatedMutationRateLimitScope,
    userId: string | number,
): string {
    return `${scope}:user:${String(userId)}`;
}

function consume(
    key: string,
    policy: MutationRateLimitPolicy,
    now: number,
): { limited: boolean; retryAfterSeconds: number } {
    if (
        now - lastCleanupAt >= CLEANUP_INTERVAL_MS ||
        rateLimitEntries.size >= MAX_RATE_LIMIT_ENTRIES
    ) {
        for (const [entryKey, entry] of rateLimitEntries.entries()) {
            if (entry.expiresAt <= now) {
                rateLimitEntries.delete(entryKey);
            }
        }
        lastCleanupAt = now;
    }

    const current = rateLimitEntries.get(key);
    if (!current || current.expiresAt <= now) {
        if (rateLimitEntries.size >= MAX_RATE_LIMIT_ENTRIES) {
            return {
                limited: true,
                retryAfterSeconds: Math.ceil(policy.windowMs / 1000),
            };
        }
        rateLimitEntries.set(key, {
            count: 1,
            expiresAt: now + policy.windowMs,
        });
        return { limited: false, retryAfterSeconds: 0 };
    }

    if (current.count >= policy.maxRequests) {
        return {
            limited: true,
            retryAfterSeconds: Math.max(
                1,
                Math.ceil((current.expiresAt - now) / 1000),
            ),
        };
    }

    rateLimitEntries.set(key, {
        count: current.count + 1,
        expiresAt: current.expiresAt,
    });
    return { limited: false, retryAfterSeconds: 0 };
}

function createRateLimitResponse(
    policy: MutationRateLimitPolicy,
    retryAfterSeconds: number,
): NextResponse {
    return NextResponse.json(
        { error: "มีคำขอมากเกินไป กรุณาลองใหม่ภายหลัง" },
        {
            status: 429,
            headers: {
                "Cache-Control": "no-store",
                "Retry-After": String(retryAfterSeconds),
                "X-RateLimit-Limit": String(policy.maxRequests),
                "X-RateLimit-Remaining": "0",
            },
        },
    );
}

export function enforcePreAuthIpRateLimit(
    request: NextRequest,
    scope: PreAuthRateLimitScope,
): NextResponse | null {
    const policy = PRE_AUTH_IP_RATE_LIMIT_POLICIES[scope];
    const result = consume(
        buildPreAuthIpKey(request, scope),
        policy,
        Date.now(),
    );
    if (!result.limited) {
        return null;
    }

    return createRateLimitResponse(policy, result.retryAfterSeconds);
}

export function enforceAuthenticatedMutationRateLimit(
    scope: AuthenticatedMutationRateLimitScope,
    userId: string | number,
): NextResponse | null {
    const policy = AUTHENTICATED_MUTATION_RATE_LIMIT_POLICIES[scope];
    const result = consume(
        buildAuthenticatedPrincipalKey(scope, userId),
        policy,
        Date.now(),
    );
    if (!result.limited) {
        return null;
    }

    return createRateLimitResponse(policy, result.retryAfterSeconds);
}

export function resetMutationRateLimit(): void {
    rateLimitEntries.clear();
    lastCleanupAt = 0;
}
