// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";

const { hashPasswordMock, prismaMock } = vi.hoisted(() => ({
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
        $transaction: vi.fn(),
    },
}));

vi.mock("bcryptjs", () => ({
    default: { hash: hashPasswordMock },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/server/audit", () => ({
    logAuthEvent: vi.fn(),
}));

function buildRequest(password = "StrongPass1"): NextRequest {
    return new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
        prismaMock.$transaction.mockImplementation(async (operation) => {
            if (typeof operation === "function") {
                return operation(prismaMock);
            }
            return Promise.all(operation);
        });
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
    });

    it("rejects an already-used token", async () => {
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(
            buildToken({ used: true }),
        );

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("rejects an expired token", async () => {
        prismaMock.passwordResetToken.findUnique.mockResolvedValue(
            buildToken({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
        );

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("does not change the password or sessions when the atomic claim loses a race", async () => {
        prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

        const response = await resetPasswordRoute(buildRequest());

        expect(response.status).toBe(400);
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toBeNull();
    });
});
