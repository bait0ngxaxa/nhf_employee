/**
 * Per-request deadline for outbound provider HTTP calls (LINE, Microsoft
 * Graph/Entra, legacy LINE webhook). Without it undici may wait for minutes,
 * which can keep an outbox batch running past the stale-PROCESSING window.
 */
export const OUTBOUND_HTTP_TIMEOUT_MS = 10_000;

/**
 * Nodemailer SMTP timeouts (milliseconds, nodemailer 10.x option names). They
 * reuse OUTBOUND_HTTP_TIMEOUT_MS so every provider shares one deadline policy;
 * the nodemailer defaults (2 min / 30 s / 10 min) let a stalled SMTP send hold
 * an outbox row for the whole stale window.
 *
 * - connectionTimeout bounds the whole setup: DNS, connect, greeting, STARTTLS.
 * - greetingTimeout is additionally capped by what remains of connectionTimeout.
 * - socketTimeout is an idle timeout, not a total deadline: it resets on every
 *   byte, so a server that keeps answering slowly can still exceed it overall.
 */
export const OUTBOUND_SMTP_TIMEOUTS = {
    connectionTimeout: OUTBOUND_HTTP_TIMEOUT_MS,
    greetingTimeout: OUTBOUND_HTTP_TIMEOUT_MS,
    socketTimeout: OUTBOUND_HTTP_TIMEOUT_MS,
} as const;

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
