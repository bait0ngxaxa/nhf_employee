import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const MAX_TRANSACTION_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 25;
const RETRY_MAX_DELAY_MS = 200;

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === code
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
            const isFinalAttempt = attempt === MAX_TRANSACTION_RETRIES - 1;
            if (!hasPrismaErrorCode(error, "P2034") || isFinalAttempt) {
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
