// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import {
    buildRefreshTokenRecord,
    hashRefreshToken,
    issueAccessToken,
    verifyAccessToken,
} from "@/lib/auth/hybrid/tokens";

describe("hybrid auth token utilities", () => {
    beforeEach(() => {
        process.env.AUTH_ACCESS_TOKEN_SECRET = "unit-test-access-secret-0123456789abcdef";
        process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS = "900";
        process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS = "2592000";
    });

    it("issues and verifies an access token", async () => {
        const token = await issueAccessToken({
            userId: 42,
            role: "ADMIN",
            sessionId: "session_123",
            tokenVersion: 3,
        });

        const payload = await verifyAccessToken(token);

        expect(payload).toEqual({
            sub: "42",
            role: "ADMIN",
            sessionId: "session_123",
            tokenVersion: 3,
        });
    });

    it("refuses to sign or verify with a missing or short access token secret", async () => {
        const claims = {
            userId: 42,
            role: "ADMIN" as const,
            sessionId: "session_123",
            tokenVersion: 3,
        };
        const token = await issueAccessToken(claims);

        process.env.AUTH_ACCESS_TOKEN_SECRET = `  ${"a".repeat(31)}  `;
        await expect(issueAccessToken(claims)).rejects.toThrow(
            "AUTH_ACCESS_TOKEN_SECRET must be at least 32 characters",
        );
        await expect(verifyAccessToken(token)).rejects.toThrow(
            "AUTH_ACCESS_TOKEN_SECRET must be at least 32 characters",
        );

        delete process.env.AUTH_ACCESS_TOKEN_SECRET;
        await expect(issueAccessToken(claims)).rejects.toThrow(
            "Missing required environment variable: AUTH_ACCESS_TOKEN_SECRET",
        );
    });

    it("creates refresh token drafts with hashed token only", () => {
        const result = buildRefreshTokenRecord({ userId: 9, ipAddress: "127.0.0.1" });

        expect(result.rawToken.length).toBeGreaterThan(40);
        expect(result.record.tokenHash).toHaveLength(64);
        expect(result.record.userId).toBe(9);
        expect(result.record.ipAddress).toBe("127.0.0.1");
        expect(result.record.familyId.length).toBeGreaterThan(10);
        expect(result.record.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("produces consistent SHA-256 hashes for the same input", () => {
        const token = "refresh-token-value";
        const hash1 = hashRefreshToken(token);
        const hash2 = hashRefreshToken(token);
        const differentHash = hashRefreshToken("different");

        expect(hash1).toBe(hash2);
        expect(hash1).not.toBe(differentHash);
        expect(hash1).toHaveLength(64);
    });
});

