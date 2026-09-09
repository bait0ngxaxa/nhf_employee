// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasEligibleEmployeeLifecycleMock, lockUserRowsMock, prismaMock } = vi.hoisted(() => ({
    hasEligibleEmployeeLifecycleMock: vi.fn(() => true),
    lockUserRowsMock: vi.fn(),
    prismaMock: {
        $queryRaw: vi.fn(),
        $transaction: vi.fn(),
        user: {
            findUnique: vi.fn(),
        },
        authRefreshToken: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/row-locks", () => ({ lockUserRows: lockUserRowsMock }));
vi.mock("@/modules/employee", () => ({
    hasEligibleEmployeeLifecycle: hasEligibleEmployeeLifecycleMock,
}));

import {
    AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS,
    rotateRefreshTokenAtomically,
} from "./refresh-token-repository";

const USER_ID = 7;
const FAMILY_ID = "family-7";
const SOURCE_ID = "source-token";
const SUCCESSOR_ID = "successor-token";

function createRotationInput(now: Date) {
    return {
        userId: USER_ID,
        tokenId: SOURCE_ID,
        now,
        nextToken: {
            userId: USER_ID,
            tokenHash: "successor-hash",
            familyId: FAMILY_ID,
            expiresAt: new Date("2030-02-01T00:00:00.000Z"),
        },
    };
}

function mockRevokedSource(revokedAt: Date, lastUsedAt: Date | null = revokedAt): void {
    prismaMock.authRefreshToken.findUnique.mockResolvedValue({
        userId: USER_ID,
        familyId: FAMILY_ID,
        revokedAt,
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        lastUsedAt,
    });
}

describe("refresh token completion classification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(
            async (callback: (client: typeof prismaMock) => Promise<unknown>) =>
                callback(prismaMock),
        );
        prismaMock.$queryRaw.mockResolvedValue([]);
        prismaMock.user.findUnique.mockResolvedValue({
            id: USER_ID,
            role: "USER",
            isActive: true,
            tokenVersion: 1,
            deletedAt: null,
            employee: null,
        });
        prismaMock.authRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("accepts a same-source completion at the finite window boundary", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-09-09T04:00:00.000Z");
        vi.setSystemTime(now);
        const rotatedAt = new Date(
            now.getTime() - AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS,
        );
        mockRevokedSource(rotatedAt);
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({
            id: SUCCESSOR_ID,
            lastUsedAt: null,
        });

        const result = await rotateRefreshTokenAtomically(createRotationInput(now));

        expect(result).toEqual({ status: "concurrentCompletion" });
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: {
                id: SUCCESSOR_ID,
                rotatedFromId: SOURCE_ID,
                revokedAt: null,
                expiresAt: { gt: now },
                lastUsedAt: null,
            },
            data: { lastUsedAt: now },
        });
    });

    it("confirms reuse outside the finite window despite an unused successor", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-09-09T04:00:00.000Z");
        vi.setSystemTime(now);
        const rotatedAt = new Date(
            now.getTime() - AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS - 1,
        );
        mockRevokedSource(rotatedAt);
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({
            id: SUCCESSOR_ID,
            lastUsedAt: null,
        });

        const result = await rotateRefreshTokenAtomically(createRotationInput(now));

        expect(result).toEqual({ status: "confirmedReuse" });
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { familyId: FAMILY_ID, revokedAt: null },
            data: { revokedAt: now },
        });
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: SUCCESSOR_ID }),
            }),
        );
    });

    it("does not classify a rotated source as concurrent completion without an active successor", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-09-09T04:00:00.000Z");
        vi.setSystemTime(now);
        mockRevokedSource(new Date(now.getTime() - 1_000));
        prismaMock.authRefreshToken.findFirst.mockResolvedValue(null);

        const result = await rotateRefreshTokenAtomically(createRotationInput(now));

        expect(result).toEqual({ status: "confirmedReuse" });
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenCalledWith({
            where: { familyId: FAMILY_ID, revokedAt: null },
            data: { revokedAt: now },
        });
    });

    it("does not classify an explicitly terminated source as concurrent completion", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-09-09T04:00:00.000Z");
        vi.setSystemTime(now);
        mockRevokedSource(new Date(now.getTime() - 1_000), null);
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({
            id: SUCCESSOR_ID,
            lastUsedAt: null,
        });

        const result = await rotateRefreshTokenAtomically(createRotationInput(now));

        expect(result).toEqual({ status: "revoked" });
        expect(prismaMock.authRefreshToken.updateMany).not.toHaveBeenCalled();
    });

    it("allows the completion marker to be claimed only once", async () => {
        vi.useFakeTimers();
        const now = new Date("2026-09-09T04:00:00.000Z");
        vi.setSystemTime(now);
        mockRevokedSource(new Date(now.getTime() - 1_000));
        prismaMock.authRefreshToken.findFirst.mockResolvedValue({
            id: SUCCESSOR_ID,
            lastUsedAt: null,
        });
        prismaMock.authRefreshToken.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });

        const firstResult = await rotateRefreshTokenAtomically(createRotationInput(now));
        const secondResult = await rotateRefreshTokenAtomically(createRotationInput(now));

        expect(firstResult).toEqual({ status: "concurrentCompletion" });
        expect(secondResult).toEqual({ status: "confirmedReuse" });
        expect(prismaMock.authRefreshToken.updateMany).toHaveBeenLastCalledWith({
            where: { familyId: FAMILY_ID, revokedAt: null },
            data: { revokedAt: now },
        });
    });
});
