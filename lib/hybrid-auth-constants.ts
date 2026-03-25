export const HYBRID_ACCESS_COOKIE_NAME = "nhf_at";
export const HYBRID_REFRESH_COOKIE_NAME = "nhf_rt";

const textEncoder = new TextEncoder();

/**
 * Resolves the JWT signing secret from environment variables.
 * Edge Runtime compatible — uses only `TextEncoder` (no Node.js `crypto`).
 */
export function getHybridSecretKey(): Uint8Array {
    const secret =
        process.env.AUTH_ACCESS_TOKEN_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim();

    if (!secret) {
        throw new Error(
            "Missing required environment variable: AUTH_ACCESS_TOKEN_SECRET or NEXTAUTH_SECRET",
        );
    }

    return textEncoder.encode(secret);
}
