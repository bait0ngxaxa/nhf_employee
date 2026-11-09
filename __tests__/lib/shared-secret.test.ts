// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    MIN_SHARED_SECRET_LENGTH,
    getConfiguredSharedSecret,
    sharedSecretsMatch,
    verifySharedSecret,
} from "@/lib/security/shared-secret";

const ENV_NAME = "AUDIT_LOG_CLEANUP_SECRET";
const HEADER_NAME = "x-cleanup-secret";
const VALID_SECRET = "a".repeat(MIN_SHARED_SECRET_LENGTH);
const REQUIREMENT = { envName: ENV_NAME, headerName: HEADER_NAME } as const;

function buildRequest(secret?: string): Request {
    return new Request("http://127.0.0.1:3000/api/audit-logs/cleanup", {
        method: "POST",
        headers: secret === undefined ? {} : { [HEADER_NAME]: secret },
    });
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("shared secret verification", () => {
    it("accepts a matching secret", () => {
        vi.stubEnv(ENV_NAME, VALID_SECRET);

        expect(verifySharedSecret(buildRequest(VALID_SECRET), REQUIREMENT)).toEqual({
            status: "valid",
        });
    });

    it("rejects a same-length mismatching secret", () => {
        vi.stubEnv(ENV_NAME, VALID_SECRET);

        expect(
            verifySharedSecret(buildRequest("b".repeat(MIN_SHARED_SECRET_LENGTH)), REQUIREMENT),
        ).toEqual({ status: "invalid" });
    });

    it("rejects secrets of different length without throwing", () => {
        vi.stubEnv(ENV_NAME, VALID_SECRET);

        expect(verifySharedSecret(buildRequest("a"), REQUIREMENT)).toEqual({ status: "invalid" });
        expect(verifySharedSecret(buildRequest(`${VALID_SECRET}a`), REQUIREMENT)).toEqual({
            status: "invalid",
        });
        expect(verifySharedSecret(buildRequest(""), REQUIREMENT)).toEqual({ status: "invalid" });
        expect(sharedSecretsMatch("short", VALID_SECRET)).toBe(false);
    });

    it("rejects a request without the secret header", () => {
        vi.stubEnv(ENV_NAME, VALID_SECRET);

        expect(verifySharedSecret(buildRequest(), REQUIREMENT)).toEqual({ status: "invalid" });
    });

    it("reports not configured when the environment variable is missing or blank", () => {
        vi.stubEnv(ENV_NAME, undefined);
        expect(getConfiguredSharedSecret(ENV_NAME)).toBeNull();
        expect(verifySharedSecret(buildRequest(VALID_SECRET), REQUIREMENT)).toEqual({
            status: "not_configured",
        });

        vi.stubEnv(ENV_NAME, "   ");
        expect(verifySharedSecret(buildRequest("   "), REQUIREMENT)).toEqual({
            status: "not_configured",
        });
    });

    it("reports not configured when the secret is shorter than the minimum", () => {
        const shortSecret = "a".repeat(MIN_SHARED_SECRET_LENGTH - 1);
        vi.stubEnv(ENV_NAME, shortSecret);

        expect(getConfiguredSharedSecret(ENV_NAME)).toBeNull();
        expect(verifySharedSecret(buildRequest(shortSecret), REQUIREMENT)).toEqual({
            status: "not_configured",
        });
    });

    it("trims surrounding whitespace from the configured secret before length check and comparison", () => {
        vi.stubEnv(ENV_NAME, `  ${VALID_SECRET}\n`);
        expect(getConfiguredSharedSecret(ENV_NAME)).toBe(VALID_SECRET);
        expect(verifySharedSecret(buildRequest(VALID_SECRET), REQUIREMENT)).toEqual({
            status: "valid",
        });

        const paddedShortSecret = `   ${"a".repeat(MIN_SHARED_SECRET_LENGTH - 1)}   `;
        vi.stubEnv(ENV_NAME, paddedShortSecret);
        expect(verifySharedSecret(buildRequest(paddedShortSecret), REQUIREMENT)).toEqual({
            status: "not_configured",
        });
    });
});
