import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const MAX_TRANSACTION_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 25;
const RETRY_MAX_DELAY_MS = 200;

function isTransactionWriteConflict(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2034"
    ) || (
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "P2034"
    );
}

function waitForRetry(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function runSerializableTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
        try {
            return await prisma.$transaction(callback, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        } catch (error) {
            if (!isTransactionWriteConflict(error) || attempt === MAX_TRANSACTION_RETRIES - 1) {
                throw error;
            }

            const delayMs = Math.min(
                RETRY_MAX_DELAY_MS,
                RETRY_BASE_DELAY_MS * 2 ** attempt,
            );
            await waitForRetry(delayMs);
        }
    }

    throw new Error("Transaction retry limit was reached unexpectedly");
}

export async function lockEmployeeRows(
    tx: Prisma.TransactionClient,
    employeeIds: readonly number[],
): Promise<void> {
    const sortedEmployeeIds = [...new Set(employeeIds)].sort((left, right) => left - right);
    if (sortedEmployeeIds.length === 0) return;

    await tx.$queryRaw`
        SELECT id
        FROM employees
        WHERE id IN (${Prisma.join(sortedEmployeeIds)})
        ORDER BY id
        FOR UPDATE
    `;
}

export async function lockLeaveRequestRow(
    tx: Prisma.TransactionClient,
    leaveId: string,
): Promise<void> {
    await tx.$queryRaw`
        SELECT id
        FROM leave_requests
        WHERE id = ${leaveId}
        FOR UPDATE
    `;
}
