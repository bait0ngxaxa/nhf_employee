// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type NextRequest } from "next/server";

import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import {
    REQUEST_BODY_INVALID_JSON_MESSAGE,
    AUTH_CREDENTIALS_MAX_REQUEST_BYTES,
    REQUEST_BODY_TOO_LARGE_MESSAGE,
} from "@/lib/ssot/request-limits";
import {
    buildJsonBodyRequest,
    CONTENT_LENGTH_MODES,
    jsonBodyOfExactBytes,
} from "@/__tests__/helpers/request-body-limit";
import { trustedNextRequest } from "@/__tests__/helpers/trusted-mutation";

const { appendAuditBestEffortMock, hashPasswordMock, prismaMock } = vi.hoisted(() => ({
    appendAuditBestEffortMock: vi.fn(),
    hashPasswordMock: vi.fn(),
    prismaMock: {
        passwordResetToken: {
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        authRefreshToken: {
            updateMany: vi.fn(),
        },
        $queryRaw: vi.fn(),
        $transaction: vi.fn(),
    },
}));

vi.mock("bcryptjs", () => ({
    default: { hash: hashPasswordMock },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/modules/audit", () => ({
    appendAuditBestEffort: appendAuditBestEffortMock,
    appendAuditInTransaction: vi.fn(),
}));

function buildRequest(password = "StrongPass1"): NextRequest {
    return trustedNextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.30",
            "x-forwarded-for": "198.51.100.30",
            "user-agent": "reset-password-test-agent",
        },
        body: JSON.stringify({
            token: "raw-reset-token",
            password,
            confirmPassword: password,
        }),
    });
}

function buildToken(overrides: Record<string, unknown> = {}) {
    return {
        id: 12,
        token: "hashed-reset-token",
        email: "user@thainhf.org",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        used: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

describe("Reset password route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appendAuditBestEffortMock.mockResolvedValue(undefined);
        hashPasswordMock.mockResolvedValue("hashed-password");
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(buildToken());
        prismaMock.passwordResetToken.update.mockResolvedValue(buildToken({ used: true }));
        prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.user.findUnique.mockResolvedValue({
            id: 7,
            email: "user@thainhf.org",
        });
        prismaMock.user.update.mockResolvedValue({ id: 7 });
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 2 });
        prismaMock.$queryRaw.mockResolvedValue([]);
        prismaMock.$transaction.mockImplementation(async (operation) => {
            if (typeof operation === "function") {
                return operation(prismaMock);
            }
            return Promise.all(operation);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("resets the password after atomically claiming an unused token", async () => {
        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(200);
        expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
            where: {
                id: 12,
                used: false,
                expiresAt: { gt: expect.any(Date) },
            },
            data: { used: true },
        });
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: {
                password: "hashed-password",
                tokenVersion: { increment: 1 },
            },
        });
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledTimes(1);
        expect(appendAuditBestEffortMock).toHaveBeenCalledWith({
            action: "PASSWORD_RESET",
            entityType: "User",
            entityId: 7,
            userId: 7,
            userEmail: "user@thainhf.org",
            ipAddress: "203.0.113.30",
            userAgent: "reset-password-test-agent",
            details: {
                metadata: {
                    method: "email_token",
                    forceLogoutAllSessions: true,
                },
            },
        });
        const lastInvalidationCall = Math.max(
            ...[
                ...prismaMock.passwordResetToken.updateMany.mock.invocationCallOrder,
                ...prismaMock.user.update.mock.invocationCallOrder,
                ...prismaMock.authRefreshToken.updateMany.mock.invocationCallOrder,
            ],
        );
        expect(lastInvalidationCall)
            .toBeLessThan(appendAuditBestEffortMock.mock.invocationCallOrder[0]);
    });

    it("rejects an already-used token", async () => {
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(
            buildToken({ used: true }),
        );

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });

    it("rejects an expired token", async () => {
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(
            buildToken({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
        );

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });

    it("does not change the password or sessions when the atomic claim loses a race", async () => {
        prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });

    it("rejects a token that expires after precheck but before the atomic claim", async () => {
        const requestStartedAt = new Date("2029-12-31T23:59:59.000Z");
        const expiresAt = new Date("2030-01-01T00:00:00.000Z");
        vi.useFakeTimers();
        vi.setSystemTime(requestStartedAt);
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(
            buildToken({ expiresAt }),
        );
        hashPasswordMock.mockImplementation(async () => {
            vi.setSystemTime(new Date("2030-01-01T00:00:00.001Z"));
            return "hashed-password";
        });
        prismaMock.passwordResetToken.updateMany.mockImplementation(
            async (args: { where: { expiresAt: { gt: Date } } }) => ({
                count: expiresAt > args.where.expiresAt.gt ? 1 : 0,
            }),
        );

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });

    it("reevaluates expiration time for each serializable transaction attempt", async () => {
        const firstAttemptAt = new Date("2029-12-31T23:59:59.000Z");
        const retryAttemptAt = new Date("2030-01-01T00:00:00.001Z");
        const expiresAt = new Date("2030-01-01T00:00:00.000Z");
        const claimedAtValues: Date[] = [];
        vi.useFakeTimers();
        vi.setSystemTime(firstAttemptAt);
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(
            buildToken({ expiresAt }),
        );
        prismaMock.passwordResetToken.updateMany.mockImplementation(
            async (args: { where: { expiresAt: { gt: Date } } }) => {
                claimedAtValues.push(args.where.expiresAt.gt);
                if (claimedAtValues.length === 1) {
                    vi.setSystemTime(retryAttemptAt);
                    throw { code: "P2034" };
                }
                return {
                    count: expiresAt > args.where.expiresAt.gt ? 1 : 0,
                };
            },
        );

        const responsePromise = resetPasswordRoute(buildRequest());
        await vi.runAllTimersAsync();
        const response = await responsePromise;

        expect(response.status).toBe(400);
        expect(claimedAtValues).toHaveLength(2);
        expect(claimedAtValues[0]).toEqual(firstAttemptAt);
        expect(claimedAtValues[1]?.getTime()).toBeGreaterThan(
            expiresAt.getTime(),
        );
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });

    it("does not audit a reset token whose user no longer exists", async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });
});

const RESET_URL = "http://localhost/api/auth/reset-password";
const RESET_HEADERS = { "cf-connecting-ip": "203.0.113.31" };
const RESET_BODY = {
    token: "raw-reset-token",
    password: "StrongPass1",
    confirmPassword: "StrongPass1",
};

describe("Reset password route body limit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(CONTENT_LENGTH_MODES)(
        "rejects an oversized body with 413 before touching the database (Content-Length %s)",
        async (contentLength) => {
            const body = jsonBodyOfExactBytes(RESET_BODY, AUTH_CREDENTIALS_MAX_REQUEST_BYTES + 1);

            const response = await resetPasswordRoute(
                buildJsonBodyRequest(RESET_URL, body, { headers: RESET_HEADERS, contentLength }),
            );

            expect(response.status).toBe(413);
            await expect(response.json()).resolves.toEqual({ error: REQUEST_BODY_TOO_LARGE_MESSAGE });
            expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        },
    );

    it("returns canonical 400 for malformed JSON", async () => {
        const response = await resetPasswordRoute(
            buildJsonBodyRequest(RESET_URL, "{not json", { headers: RESET_HEADERS }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: REQUEST_BODY_INVALID_JSON_MESSAGE });
        expect(prismaMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(appendAuditBestEffortMock).not.toHaveBeenCalled();
    });

    it("processes a valid body of exactly the limit", async () => {
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
        const body = jsonBodyOfExactBytes(RESET_BODY, AUTH_CREDENTIALS_MAX_REQUEST_BYTES);

        const response = await resetPasswordRoute(
            buildJsonBodyRequest(RESET_URL, body, { headers: RESET_HEADERS }),
        );

        // Reaches the token lookup (unknown token -> existing invalid-link 400).
        expect(response.status).toBe(400);
        expect(prismaMock.passwordResetToken.findUnique).toHaveBeenCalledTimes(1);
    });
});
