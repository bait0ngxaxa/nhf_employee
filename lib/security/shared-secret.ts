import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Minimum length for a machine-to-machine shared secret. Shorter values are
 * treated as "not configured" so a weak secret fails closed instead of
 * silently protecting an endpoint.
 */
export const MIN_SHARED_SECRET_LENGTH = 32;

export type SharedSecretEnvName =
    | "AUTH_CLEANUP_SECRET"
    | "AUDIT_LOG_CLEANUP_SECRET"
    | "IT_ATTACHMENT_CLEANUP_SECRET"
    | "LEAVE_ATTACHMENT_CLEANUP_SECRET"
    | "NOTIFICATION_OUTBOX_CRON_SECRET"
    | "ROUTINE_SCHEDULER_CRON_SECRET";

export interface SharedSecretRequirement {
    envName: SharedSecretEnvName;
    headerName: string;
}

export type SharedSecretVerification =
    | { status: "valid" }
    | { status: "invalid" }
    | { status: "not_configured" };

export function getConfiguredSharedSecret(envName: SharedSecretEnvName): string | null {
    const secret = process.env[envName]?.trim();
    if (!secret || secret.length < MIN_SHARED_SECRET_LENGTH) {
        return null;
    }
    return secret;
}

function sha256(value: string): Buffer {
    return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Compares two secrets in constant time. Both values are hashed first so the
 * comparison always runs over equal-length digests and does not leak the
 * length of the expected secret.
 */
export function sharedSecretsMatch(provided: string, expected: string): boolean {
    return timingSafeEqual(sha256(provided), sha256(expected));
}

/**
 * Verifies a shared-secret request header against its environment variable.
 * Each route maps the result to its own HTTP contract.
 */
export function verifySharedSecret(
    request: Request,
    requirement: SharedSecretRequirement,
): SharedSecretVerification {
    const expected = getConfiguredSharedSecret(requirement.envName);
    if (expected === null) {
        return { status: "not_configured" };
    }

    const provided = request.headers.get(requirement.headerName);
    if (provided === null || !sharedSecretsMatch(provided, expected)) {
        return { status: "invalid" };
    }

    return { status: "valid" };
}
