const HYBRID_AUTH_INTERNAL_PATHS = new Set([
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/auth/logout-all",
]);

let refreshInFlight: Promise<boolean> | null = null;

function isHybridInternalPath(url: string): boolean {
    return HYBRID_AUTH_INTERNAL_PATHS.has(url);
}

export function shouldAttemptHybridRefresh(url: string): boolean {
    return !isHybridInternalPath(url);
}

export async function refreshHybridSession(): Promise<boolean> {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
    })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
            refreshInFlight = null;
        });

    return refreshInFlight;
}

export async function logoutHybridSession(path = "/api/auth/logout"): Promise<void> {
    try {
        await fetch(path, {
            method: "POST",
            credentials: "include",
        });
    } catch {
        // Best-effort logout; caller will still clear NextAuth session.
    }
}
