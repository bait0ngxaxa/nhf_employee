import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { verifyAccessToken } from "@/lib/auth/hybrid/tokens";
import {
    resolveAuthenticatedPrincipal,
    resolveAuthenticatedUserId,
} from "@/modules/auth";
import type { AccessTokenClaims } from "@/lib/auth/hybrid/tokens";
import type * as AuthTokenModule from "@/lib/auth/hybrid/tokens";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/auth/hybrid/tokens", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthTokenModule>();
    return { ...actual, verifyAccessToken: vi.fn() };
});

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;
const verifyAccessTokenMock = vi.mocked(verifyAccessToken);

const CLAIMS: AccessTokenClaims = {
    sub: "42",
    role: "USER",
    sessionId: "family-1",
    tokenVersion: 7,
};

describe("Auth authenticated principal", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        verifyAccessTokenMock.mockReset();
        verifyAccessTokenMock.mockResolvedValue(CLAIMS);
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({
            id: "refresh-1",
        } as never);
        prismaMock.user.findUnique.mockResolvedValue({
            role: "ADMIN",
            isActive: true,
            deletedAt: null,
            tokenVersion: 7,
            employee: null,
        } as never);
    });

    it("uses the current database role while preserving token/session validation", async () => {
        const principal = await resolveAuthenticatedPrincipal("signed-token");

        expect(principal).toEqual({
            userId: 42,
            role: "ADMIN",
            sessionFamilyId: "family-1",
            tokenVersion: 7,
        });
        expect(verifyAccessTokenMock).toHaveBeenCalledWith("signed-token");
        expect(prismaMock.authRefreshToken.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId: 42,
                    familyId: "family-1",
                    revokedAt: null,
                    expiresAt: { gt: expect.any(Date) },
                },
            }),
        );
        expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1);
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 42 },
                select: expect.objectContaining({ role: true }),
            }),
        );
    });

    it("keeps resolving a User without an Employee through the legacy User-id contract", async () => {
        await expect(resolveAuthenticatedUserId("signed-token")).resolves.toBe(42);
    });
});
