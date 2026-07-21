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

export function isRetryableTransactionError(error: unknown): boolean {
    return hasPrismaErrorCode(error, "P2034");
}

function getRetryDelayMs(attempt: number): number {
    const exponentialDelayMs = Math.min(
        RETRY_MAX_DELAY_MS,
        RETRY_BASE_DELAY_MS * 2 ** attempt,
    );
    const jitterLimitMs = Math.floor(exponentialDelayMs * 0.2);
    const jitterMs = Math.round(Math.random() * jitterLimitMs);
    return Math.min(RETRY_MAX_DELAY_MS, exponentialDelayMs + jitterMs);
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
            if (!isRetryableTransactionError(error) || isFinalAttempt) {
                throw error;
            }

            await waitForRetry(getRetryDelayMs(attempt));
        }
    }

    throw new Error("Transaction retry limit was reached unexpectedly");
}
