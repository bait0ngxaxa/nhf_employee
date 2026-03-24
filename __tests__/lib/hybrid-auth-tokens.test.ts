// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import {
    buildRefreshTokenRecord,
    constantTimeHashCompare,
    hashRefreshToken,
    issueAccessToken,
    verifyAccessToken,
} from "@/lib/hybrid-auth-tokens";

describe("hybrid auth token utilities", () => {
    beforeEach(() => {
        process.env.AUTH_ACCESS_TOKEN_SECRET = "unit-test-access-secret";
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

    it("creates refresh token drafts with hashed token only", () => {
        const result = buildRefreshTokenRecord({ userId: 9, ipAddress: "127.0.0.1" });

        expect(result.rawToken.length).toBeGreaterThan(40);
        expect(result.record.tokenHash).toHaveLength(64);
        expect(result.record.userId).toBe(9);
        expect(result.record.ipAddress).toBe("127.0.0.1");
        expect(result.record.familyId.length).toBeGreaterThan(10);
        expect(result.record.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("compares hashed refresh tokens in constant time", () => {
        const token = "refresh-token-value";
        const hash = hashRefreshToken(token);
        const sameHash = hashRefreshToken(token);
        const differentHash = hashRefreshToken("different");

        expect(constantTimeHashCompare(hash, sameHash)).toBe(true);
        expect(constantTimeHashCompare(hash, differentHash)).toBe(false);
    });
});

