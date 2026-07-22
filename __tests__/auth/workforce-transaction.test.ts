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
    employeeId?: number | null;
    isActive?: boolean;
} = {}): {
    tx: Prisma.TransactionClient;
    queryRaw: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
} {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findUnique = vi.fn().mockResolvedValue({
        employeeId: options.employeeId === undefined ? 100 : options.employeeId,
    });
    const findFirst = vi.fn().mockResolvedValue(
        options.isActive === false ? null : { id: 7 },
    );

    return {
        tx: {
            $queryRaw: queryRaw,
            user: { findUnique, findFirst },
        } as unknown as Prisma.TransactionClient,
        queryRaw,
        findUnique,
        findFirst,
    };
}

describe("assertActiveWorkforceInTransaction", () => {
    it("should lock user and employee before the final active-state check", async () => {
        const { tx, queryRaw, findUnique, findFirst } = transactionClient();

        await assertActiveWorkforceInTransaction(tx, 7);

        expect(queryRaw).toHaveBeenCalledTimes(2);
        expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
            findUnique.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
        );
        expect(findUnique.mock.invocationCallOrder[0]).toBeLessThan(
            queryRaw.mock.invocationCallOrder[1] ?? Number.MAX_SAFE_INTEGER,
        );
        expect(queryRaw.mock.invocationCallOrder[1]).toBeLessThan(
            findFirst.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
        );
    });

    it("should reject when the locked workforce is no longer active", async () => {
        const { tx } = transactionClient({ isActive: false });

        await expect(
            assertActiveWorkforceInTransaction(tx, 7),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
    });

    it("should reject a user without an employee profile before employee lock", async () => {
        const { tx, queryRaw, findFirst } = transactionClient({ employeeId: null });

        await expect(
            assertActiveWorkforceInTransaction(tx, 7),
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);

        expect(queryRaw).toHaveBeenCalledTimes(1);
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
            if (rawQueryCount === 2) {
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

        const authorizationPromise = assertActiveWorkforceInTransaction(tx, 7);
        const authorizationExpectation = expect(
            authorizationPromise,
        ).rejects.toBeInstanceOf(WorkforceAuthorizationError);
        await workforceWaitingForEmployee.promise;
        commitSuspension.resolve();
        await suspensionPromise;
        await authorizationExpectation;
    });
});
