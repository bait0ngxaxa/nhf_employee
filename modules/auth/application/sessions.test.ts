// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    buildRefreshTokenRecordMock,
    findRefreshTokenByHashMock,
    hashRefreshTokenMock,
    issueAccessTokenMock,
    rotateRefreshTokenAtomicallyMock,
} = vi.hoisted(() => ({
    buildRefreshTokenRecordMock: vi.fn(),
    findRefreshTokenByHashMock: vi.fn(),
    hashRefreshTokenMock: vi.fn(),
    issueAccessTokenMock: vi.fn(),
    rotateRefreshTokenAtomicallyMock: vi.fn(),
}));

vi.mock("@/lib/auth/hybrid/tokens", () => ({
    buildRefreshTokenRecord: buildRefreshTokenRecordMock,
    hashRefreshToken: hashRefreshTokenMock,
    issueAccessToken: issueAccessTokenMock,
    verifyAccessToken: vi.fn(),
}));

vi.mock("../infrastructure/persistence/account-repository", () => ({
    findAccountForLogout: vi.fn(),
    findAccountForResolution: vi.fn(),
}));

vi.mock("../infrastructure/persistence/refresh-token-repository", () => ({
    cleanupRefreshTokens: vi.fn(),
    findActiveOwnedRefreshToken: vi.fn(),
    findRefreshTokenByHash: findRefreshTokenByHashMock,
    findRefreshTokenFamily: vi.fn(),
    hasActiveSessionFamily: vi.fn(),
    listActiveRefreshSessions: vi.fn(),
    revokeAllRefreshTokensForUser: vi.fn(),
    revokeCurrentRefreshToken: vi.fn(),
    revokeRefreshFamily: vi.fn(),
    rotateRefreshTokenAtomically: rotateRefreshTokenAtomicallyMock,
}));

import { refreshHybridSession } from "./sessions";

function createRefreshToken() {
    return {
        id: "source-token",
        userId: 7,
        tokenHash: "hashed-source-token",
        familyId: "family-7",
        rotatedFromId: null,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        revokedAt: null,
        lastUsedAt: null,
        userAgent: "test-agent",
        ipAddress: "192.0.2.7",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
            id: 7,
            email: "session-test@thainhf.org",
            role: "USER" as const,
            isActive: true,
            deletedAt: null,
            tokenVersion: 4,
            employee: null,
        },
    };
}

describe("refresh session state-machine outcomes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hashRefreshTokenMock.mockReturnValue("hashed-source-token");
        findRefreshTokenByHashMock.mockResolvedValue(createRefreshToken());
        buildRefreshTokenRecordMock.mockReturnValue({
            rawToken: "successor-raw-token",
            record: {
                userId: 7,
                tokenHash: "hashed-successor-token",
                familyId: "family-7",
                expiresAt: new Date("2030-02-01T00:00:00.000Z"),
                userAgent: "test-agent",
                ipAddress: "192.0.2.7",
            },
        });
        issueAccessTokenMock.mockResolvedValue("new-access-token");
        rotateRefreshTokenAtomicallyMock.mockResolvedValue({
            status: "rotated",
            account: { role: "ADMIN", tokenVersion: 9 },
        });
    });

    it("issues the successor using the account state from the atomic rotation", async () => {
        const result = await refreshHybridSession({
            rawRefreshToken: "source-raw-token",
            metadata: { ipAddress: "192.0.2.7", userAgent: "test-agent" },
        });

        expect(result).toEqual({
            status: "success",
            accessToken: "new-access-token",
            rawRefreshToken: "successor-raw-token",
        });
        expect(rotateRefreshTokenAtomicallyMock).toHaveBeenCalledWith({
            userId: 7,
            tokenId: "source-token",
            now: expect.any(Date),
            nextToken: expect.objectContaining({ userId: 7, familyId: "family-7" }),
        });
        expect(issueAccessTokenMock).toHaveBeenCalledWith({
            userId: 7,
            role: "ADMIN",
            sessionId: "family-7",
            tokenVersion: 9,
        });
    });

    it("does not treat a concurrent completion as malicious reuse", async () => {
        rotateRefreshTokenAtomicallyMock.mockResolvedValue({
            status: "concurrentCompletion",
        });

        await expect(refreshHybridSession({
            rawRefreshToken: "source-raw-token",
            metadata: {},
        })).resolves.toEqual({
            status: "unauthorized",
            preserveCookies: true,
        });
    });

    it.each([
        ["confirmedReuse", "refresh_token_reuse_or_expired"],
        ["expired", "refresh_token_reuse_or_expired"],
        ["inactiveAccount", "inactive_user_refresh_attempt"],
    ] as const)("maps %s to its security event", async (status, reason) => {
        rotateRefreshTokenAtomicallyMock.mockResolvedValue({ status });

        const result = await refreshHybridSession({
            rawRefreshToken: "source-raw-token",
            metadata: { ipAddress: "192.0.2.7", userAgent: "test-agent" },
        });

        expect(result).toEqual({
            status: "unauthorized",
            securityEvent: {
                userId: 7,
                email: "session-test@thainhf.org",
                familyId: "family-7",
                reason,
                ipAddress: "192.0.2.7",
                userAgent: "test-agent",
            },
        });
    });

    it("does not emit a reuse event for a terminated family", async () => {
        rotateRefreshTokenAtomicallyMock.mockResolvedValue({ status: "revoked" });

        await expect(refreshHybridSession({
            rawRefreshToken: "source-raw-token",
            metadata: {},
        })).resolves.toEqual({ status: "unauthorized" });
    });

    it("returns a plain unauthorized result for an invalid transition", async () => {
        rotateRefreshTokenAtomicallyMock.mockResolvedValue({ status: "invalid" });

        await expect(refreshHybridSession({
            rawRefreshToken: "source-raw-token",
            metadata: {},
        })).resolves.toEqual({ status: "unauthorized" });
    });
});
