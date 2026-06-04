interface AuthRateLimitEntry {
    count: number;
    expiresAt: number;
}

interface AuthRateLimitPolicy {
    windowMs: number;
    maxAttemptsPerIdentity: number;
    maxAttemptsPerIp: number;
}

interface AuthRateLimitInput {
    scope: string;
    identity: string;
    ipAddress?: string;
}

const authAttempts = new Map<string, AuthRateLimitEntry>();

function cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of authAttempts.entries()) {
        if (entry.expiresAt <= now) {
            authAttempts.delete(key);
        }
    }
}

function normalizeIdentity(identity: string): string {
    return identity.trim().toLowerCase();
}

function normalizeIpAddress(ipAddress?: string): string {
    return ipAddress?.trim() || "unknown";
}

function buildIdentityKey(input: AuthRateLimitInput): string {
    return `${input.scope}:identity:${normalizeIdentity(input.identity)}`;
}

function buildIpKey(input: AuthRateLimitInput): string {
    return `${input.scope}:ip:${normalizeIpAddress(input.ipAddress)}`;
}

function getCount(key: string): number {
    return authAttempts.get(key)?.count ?? 0;
}

function recordKey(key: string, now: number, windowMs: number): void {
    const current = authAttempts.get(key);
    if (!current || current.expiresAt <= now) {
        authAttempts.set(key, {
            count: 1,
            expiresAt: now + windowMs,
        });
        return;
    }

    authAttempts.set(key, {
        count: current.count + 1,
        expiresAt: current.expiresAt,
    });
}

export function isAuthRateLimited(
    input: AuthRateLimitInput,
    policy: AuthRateLimitPolicy,
): boolean {
    const now = Date.now();
    cleanupExpiredEntries(now);

    return (
        getCount(buildIdentityKey(input)) >= policy.maxAttemptsPerIdentity ||
        getCount(buildIpKey(input)) >= policy.maxAttemptsPerIp
    );
}

export function recordAuthAttempt(
    input: AuthRateLimitInput,
    policy: Pick<AuthRateLimitPolicy, "windowMs">,
): void {
    const now = Date.now();
    cleanupExpiredEntries(now);
    recordKey(buildIdentityKey(input), now, policy.windowMs);
    recordKey(buildIpKey(input), now, policy.windowMs);
}

export function clearAuthIdentityRateLimit(input: AuthRateLimitInput): void {
    authAttempts.delete(buildIdentityKey(input));
}

export function resetAuthRateLimit(): void {
    authAttempts.clear();
}
