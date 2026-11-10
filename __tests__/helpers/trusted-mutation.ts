import { NextRequest } from "next/server";

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

/**
 * Headers a same-origin browser sends on a mutation, matching the
 * lib/auth/csrf.ts contract (trusted Origin + X-Requested-With).
 */
export function trustedMutationHeaders(url: string | URL): Record<string, string> {
    return {
        origin: new URL(url).origin,
        "x-requested-with": "XMLHttpRequest",
    };
}

/**
 * Adds the trusted-mutation headers to `init` without overriding any header
 * the test set explicitly, so negative CSRF cases can still pass a foreign
 * Origin or an empty X-Requested-With.
 */
export function withTrustedMutationHeaders<Init extends { headers?: HeadersInit }>(
    url: string | URL,
    init?: Init,
): Init & { headers: Headers } {
    const headers = new Headers(init?.headers);
    for (const [name, value] of Object.entries(trustedMutationHeaders(url))) {
        if (!headers.has(name)) headers.set(name, value);
    }
    return { ...(init ?? ({} as Init)), headers };
}

/** `new NextRequest(...)` as sent by the app's own browser clients. */
export function trustedNextRequest(input: string | URL, init?: NextRequestInit): NextRequest {
    return new NextRequest(input, withTrustedMutationHeaders(input, init ?? {}));
}
