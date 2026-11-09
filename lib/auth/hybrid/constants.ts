export const HYBRID_ACCESS_COOKIE_NAME = "__Host-nhf_at";
export const HYBRID_REFRESH_COOKIE_NAME = "__Host-nhf_rt";

export const MIN_HYBRID_ACCESS_TOKEN_SECRET_LENGTH = 32;

const textEncoder = new TextEncoder();

/**
 * Resolves the JWT signing secret from environment variables.
 * Edge Runtime compatible — uses only `TextEncoder` (no Node.js `crypto`).
 */
export function getHybridSecretKey(): Uint8Array {
    const secret = process.env.AUTH_ACCESS_TOKEN_SECRET?.trim();

    if (!secret) {
        throw new Error(
            "Missing required environment variable: AUTH_ACCESS_TOKEN_SECRET",
        );
    }

    if (secret.length < MIN_HYBRID_ACCESS_TOKEN_SECRET_LENGTH) {
        throw new Error(
            `AUTH_ACCESS_TOKEN_SECRET must be at least ${MIN_HYBRID_ACCESS_TOKEN_SECRET_LENGTH} characters`,
        );
    }

    return textEncoder.encode(secret);
}
