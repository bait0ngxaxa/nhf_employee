import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    MAX_OUTBOX_ATTEMPTS,
    OUTBOX_RETRY_BASE_DELAY_MS,
    STALE_OUTBOX_PROCESSING_MINUTES,
} from "@/lib/services/outbox/types";
import { processOutbox } from "@/lib/services/outbox/processor";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("DATABASE_URL is required for integration tests");

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error("Integration tests require a dedicated MySQL database");
    }
}

describe("NotificationOutbox MySQL state transitions", () => {
    beforeEach(async () => {
        assertDedicatedDatabase();
        await prisma.notificationOutbox.deleteMany();
    });

    it.each([0, 1, 2])(
        "recovers stale PROCESSING at attempt %s with a real database transition",
        async (attempts) => {
            const staleAt = new Date(
                Date.now()
                    - STALE_OUTBOX_PROCESSING_MINUTES * 60_000
                    - 1_000,
            );
            const row = await prisma.notificationOutbox.create({
                data: {
                    type: "LEAVE_CANCELLED",
                    payload: "{}",
                    status: "PROCESSING",
                    attempts,
                    nextAttemptAt: staleAt,
                    lastError: null,
                    createdAt: staleAt,
                    updatedAt: staleAt,
                },
            });

            const beforeRecovery = Date.now();
            await processOutbox();
            const recovered = await prisma.notificationOutbox.findUniqueOrThrow({
                where: { id: row.id },
            });

            expect(recovered.status).toBe(
                attempts === MAX_OUTBOX_ATTEMPTS - 1 ? "DEAD" : "FAILED",
            );
            expect(recovered.attempts).toBe(
                Math.min(attempts + 1, MAX_OUTBOX_ATTEMPTS),
            );
            expect(recovered.lastError).toBe("Processing timeout");

            if (attempts < MAX_OUTBOX_ATTEMPTS - 1) {
                const nextAttemptAt = recovered.nextAttemptAt;
                expect(nextAttemptAt).not.toBeNull();
                if (nextAttemptAt === null) {
                    throw new Error("Expected a retry schedule");
                }
                expect(nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
                    beforeRecovery + OUTBOX_RETRY_BASE_DELAY_MS - 1_000,
                );
            } else {
                expect(recovered.nextAttemptAt).toEqual(staleAt);
            }
        },
    );

    it("allows only one concurrent worker to claim a due row", async () => {
        const row = await prisma.notificationOutbox.create({
            data: {
                type: "LEAVE_CANCELLED",
                payload: "not-json",
                nextAttemptAt: new Date(Date.now() - 1_000),
            },
        });

        const results = await Promise.all([
            processOutbox(),
            processOutbox(),
        ]);
        const finalRow = await prisma.notificationOutbox.findUniqueOrThrow({
            where: { id: row.id },
        });

        expect(results).toContainEqual({ processed: 0, failed: 1 });
        expect(results).toContainEqual({ processed: 0, failed: 0 });
        expect(finalRow.status).toBe("FAILED");
        expect(finalRow.attempts).toBe(1);
    });
});
