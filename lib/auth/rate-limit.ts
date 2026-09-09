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

export interface AuthRateLimitReservation {
    commit(): void;
    release(): void;
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

function incrementKey(key: string, now: number, windowMs: number): number {
    const current = authAttempts.get(key);
    if (!current || current.expiresAt <= now) {
        const expiresAt = now + windowMs;
        authAttempts.set(key, {
            count: 1,
            expiresAt,
        });
        return expiresAt;
    }

    authAttempts.set(key, {
        count: current.count + 1,
        expiresAt: current.expiresAt,
    });
    return current.expiresAt;
}

function decrementKey(key: string, expiresAt: number): void {
    const current = authAttempts.get(key);
    if (!current || current.expiresAt !== expiresAt) return;

    if (current.count <= 1) {
        authAttempts.delete(key);
        return;
    }

    authAttempts.set(key, {
        count: current.count - 1,
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

/**
 * Reserve one failed-authentication budget slot synchronously before work
 * that may await. The caller commits a failed attempt or releases the slot
 * when authentication succeeds or cannot produce a failed attempt.
 */
export function reserveAuthAttempt(
    input: AuthRateLimitInput,
    policy: AuthRateLimitPolicy,
): AuthRateLimitReservation | null {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const identityKey = buildIdentityKey(input);
    const ipKey = buildIpKey(input);
    if (
        getCount(identityKey) >= policy.maxAttemptsPerIdentity
        || getCount(ipKey) >= policy.maxAttemptsPerIp
    ) {
        return null;
    }

    const identityExpiresAt = incrementKey(identityKey, now, policy.windowMs);
    const ipExpiresAt = incrementKey(ipKey, now, policy.windowMs);
    let settled = false;

    return {
        commit(): void {
            settled = true;
        },
        release(): void {
            if (settled) return;
            settled = true;
            decrementKey(identityKey, identityExpiresAt);
            decrementKey(ipKey, ipExpiresAt);
        },
    };
}

export function recordAuthAttempt(
    input: AuthRateLimitInput,
    policy: Pick<AuthRateLimitPolicy, "windowMs">,
): void {
    const now = Date.now();
    cleanupExpiredEntries(now);
    incrementKey(buildIdentityKey(input), now, policy.windowMs);
    incrementKey(buildIpKey(input), now, policy.windowMs);
}

export function clearAuthIdentityRateLimit(input: AuthRateLimitInput): void {
    authAttempts.delete(buildIdentityKey(input));
}

export function resetAuthRateLimit(): void {
    authAttempts.clear();
}
