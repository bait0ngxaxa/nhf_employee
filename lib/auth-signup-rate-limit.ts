const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const MAX_SIGNUP_ATTEMPTS_PER_WINDOW = 5;

type SignupAttemptEntry = {
    count: number;
    expiresAt: number;
};

const signupAttempts = new Map<string, SignupAttemptEntry>();

function getWindowExpiry(now: number): number {
    return now + SIGNUP_WINDOW_MS;
}

function cleanupExpiredEntries(now: number): void {
    for (const [key, entry] of signupAttempts.entries()) {
        if (entry.expiresAt <= now) {
            signupAttempts.delete(key);
        }
    }
}

function normalizeSignupRateLimitKey(email: string, ipAddress?: string): string {
    return `${email.toLowerCase()}::${ipAddress ?? "unknown"}`;
}

export function isSignupRateLimited(email: string, ipAddress?: string): boolean {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const key = normalizeSignupRateLimitKey(email, ipAddress);
    const entry = signupAttempts.get(key);

    return (entry?.count ?? 0) >= MAX_SIGNUP_ATTEMPTS_PER_WINDOW;
}

export function recordSignupAttempt(email: string, ipAddress?: string): void {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const key = normalizeSignupRateLimitKey(email, ipAddress);
    const current = signupAttempts.get(key);

    if (!current || current.expiresAt <= now) {
        signupAttempts.set(key, {
            count: 1,
            expiresAt: getWindowExpiry(now),
        });
        return;
    }

    signupAttempts.set(key, {
        count: current.count + 1,
        expiresAt: current.expiresAt,
    });
}

export function clearSignupRateLimit(email: string, ipAddress?: string): void {
    const key = normalizeSignupRateLimitKey(email, ipAddress);
    signupAttempts.delete(key);
}

export function resetSignupRateLimit(): void {
    signupAttempts.clear();
}
