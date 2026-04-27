import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies LINE webhook signature using HMAC-SHA256.
 * Tries each provided channel secret and returns true if any match.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyLineSignature(
    rawBody: string,
    signature: string,
    channelSecrets: readonly string[]
): boolean {
    if (!signature || channelSecrets.length === 0) {
        return false;
    }

    const signatureBuffer = Buffer.from(signature, "base64");

    for (const secret of channelSecrets) {
        const generated = createHmac("SHA256", secret)
            .update(rawBody)
            .digest();

        // Both buffers must be same length for timingSafeEqual
        if (
            signatureBuffer.length === generated.length &&
            timingSafeEqual(signatureBuffer, generated)
        ) {
            return true;
        }
    }

    return false;
}
