import { AUTH_MUTATION_HEADERS } from "@/lib/auth-csrf";
import { API_ROUTES } from "@/lib/ssot/routes";

const HYBRID_AUTH_INTERNAL_PATHS: ReadonlySet<string> = new Set<string>([
    API_ROUTES.auth.refresh,
    API_ROUTES.auth.logout,
    API_ROUTES.auth.logoutAll,
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

    refreshInFlight = fetch(API_ROUTES.auth.refresh, {
        method: "POST",
        credentials: "include",
        headers: AUTH_MUTATION_HEADERS,
    })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
            refreshInFlight = null;
        });

    return refreshInFlight;
}

/**
 * Wraps a fetch call with automatic 401 -> refresh -> retry logic.
 * Shared by `api-client.ts` and `swr.ts` to avoid duplicating the retry pattern.
 */
export async function fetchWithRefresh(
    url: string,
    init?: RequestInit,
): Promise<Response> {
    let response = await fetch(url, init);

    if (response.status === 401 && shouldAttemptHybridRefresh(url)) {
        const refreshed = await refreshHybridSession();
        if (refreshed) {
            response = await fetch(url, init);
        }
    }

    return response;
}

export async function logoutHybridSession(path = API_ROUTES.auth.logout): Promise<void> {
    try {
        await fetch(path, {
            method: "POST",
            credentials: "include",
            headers: AUTH_MUTATION_HEADERS,
        });
    } catch {
        // Best-effort logout; caller will still clear NextAuth session.
    }
}
