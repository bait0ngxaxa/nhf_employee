import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
    assertActiveWorkforceInTransaction,
    WorkforceAuthorizationError,
} from "@/lib/auth/workforce-transaction";

type Deferred = { promise: Promise<void>; resolve: () => void };

function deferred(): Deferred {
    let resolvePromise: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}

function transactionClient(options: {
    isActive?: boolean;
} = {}): {
    tx: Prisma.TransactionClient;
    queryRaw: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
} {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findFirst = vi.fn().mockResolvedValue(
        options.isActive === false ? null : { id: 7 },
    );

    return {
        tx: {
            $queryRaw: queryRaw,
            user: { findFirst },
        } as unknown as Prisma.TransactionClient,
        queryRaw,
        findFirst,
    };
}

describe("assertActiveWorkforceInTransaction", () => {
    it("should lock employee then user before the final active-state check", async () => {
        const { tx, queryRaw, findFirst } = transactionClient();

        await assertActiveWorkforceInTransaction(tx, 7, 100);

        expect(queryRaw).toHaveBeenCalledTimes(2);
        expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(queryRaw.mock.invocationCallOrder[1] ?? Number.MAX_SAFE_INTEGER);
        expect(queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
            findFirst.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
        );
    });

    it("should reject when the locked workforce is no longer active", async () => {
        const { tx } = transactionClient({ isActive: false });

        await expect(
            assertActiveWorkforceInTransaction(tx, 7, 100),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
    });

    it("should reject a user without an employee profile before taking locks", async () => {
        const { tx, queryRaw, findFirst } = transactionClient();

        await expect(
            assertActiveWorkforceInTransaction(tx, 7, null),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);

        expect(queryRaw).not.toHaveBeenCalled();
        expect(findFirst).not.toHaveBeenCalled();
    });

    it("should observe suspension committed while waiting for the employee lock", async () => {
        const employeeLockAcquired = deferred();
        const commitSuspension = deferred();
        const releaseEmployeeLock = deferred();
        const workforceWaitingForEmployee = deferred();
        const state = { isActive: true };
        let rawQueryCount = 0;

        const suspensionPromise = (async (): Promise<void> => {
            employeeLockAcquired.resolve();
            await commitSuspension.promise;
            state.isActive = false;
            releaseEmployeeLock.resolve();
        })();
        await employeeLockAcquired.promise;

        const queryRaw = vi.fn(async (): Promise<unknown[]> => {
            rawQueryCount += 1;
            if (rawQueryCount === 1) {
                workforceWaitingForEmployee.resolve();
                await releaseEmployeeLock.promise;
            }
            return [];
        });
        const tx = {
            $queryRaw: queryRaw,
            user: {
                findUnique: vi.fn().mockResolvedValue({ employeeId: 100 }),
                findFirst: vi.fn(async () => state.isActive ? { id: 7 } : null),
            },
        } as unknown as Prisma.TransactionClient;

        const authorizationPromise = assertActiveWorkforceInTransaction(tx, 7, 100);
        const authorizationExpectation = expect(
            authorizationPromise,
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        await workforceWaitingForEmployee.promise;
        commitSuspension.resolve();
        await suspensionPromise;
        await authorizationExpectation;
    });
});
