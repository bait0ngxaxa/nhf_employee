export const AUTH_MUTATION_HEADERS: Readonly<Record<string, string>> = {
    "X-Requested-With": "XMLHttpRequest",
};

/** GET and HEAD are reads; every other method is treated as a mutation. */
export function isAuthMutationMethod(method: string | undefined): boolean {
    const normalizedMethod = method?.toUpperCase() ?? "GET";
    return normalizedMethod !== "GET" && normalizedMethod !== "HEAD";
}

/**
 * Single browser-side source of the trusted-mutation headers checked by
 * lib/auth/csrf.ts. Adds them to mutating methods only and never overrides a
 * value the caller already set.
 */
export function applyAuthMutationHeaders(
    headers: Headers,
    method: string | undefined,
): Headers {
    if (!isAuthMutationMethod(method)) return headers;
    for (const [name, value] of Object.entries(AUTH_MUTATION_HEADERS)) {
        if (!headers.has(name)) headers.set(name, value);
    }
    return headers;
}

/**
 * Returns a copy of `init` whose headers carry the trusted-mutation headers
 * when `init.method` mutates. Reads are returned unchanged.
 */
export function withAuthMutationHeaders(init: RequestInit = {}): RequestInit {
    if (!isAuthMutationMethod(init.method)) return init;
    return {
        ...init,
        headers: applyAuthMutationHeaders(new Headers(init.headers), init.method),
    };
}
