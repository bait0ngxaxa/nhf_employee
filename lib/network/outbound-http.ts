/**
 * Per-request deadline for outbound provider HTTP calls (LINE, Microsoft
 * Graph/Entra, legacy LINE webhook). Without it undici may wait for minutes,
 * which can keep an outbox batch running past the stale-PROCESSING window.
 */
export const OUTBOUND_HTTP_TIMEOUT_MS = 10_000;

/**
 * Creates a fresh signal per request. On expiry fetch rejects with a
 * `TimeoutError` DOMException, which callers treat as a failed send.
 */
export function createOutboundHttpSignal(): AbortSignal {
    return AbortSignal.timeout(OUTBOUND_HTTP_TIMEOUT_MS);
}

export function isOutboundHttpTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.name === "TimeoutError";
}
