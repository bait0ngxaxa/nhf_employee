import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";

const dispatchRoutineReminderOutboxMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/services/routine/reminders", () => ({
    dispatchRoutineReminderOutbox: dispatchRoutineReminderOutboxMock,
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildNotification(): NotificationOutbox {
    return {
        id: 701,
        type: "ROUTINE_REMINDER_IN_APP",
        eventKey: "routine:91:rule:31:version:2",
        payload: JSON.stringify({ occurrenceId: 91 }),
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe("notification outbox Routine dispatch", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([buildNotification()]),
        );
        dispatchRoutineReminderOutboxMock.mockResolvedValue("SENT");
    });

    it("routes Routine reminders through the existing processor", async () => {
        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(dispatchRoutineReminderOutboxMock).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 701,
                type: "ROUTINE_REMINDER_IN_APP",
                payload: JSON.stringify({ occurrenceId: 91 }),
            }),
            { occurrenceId: 91 },
        );
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 701, status: "PROCESSING" },
                data: expect.objectContaining({ status: "SENT" }),
            }),
        );
    });

    it("marks a failed email side effect for the existing outbox retry policy", async () => {
        dispatchRoutineReminderOutboxMock.mockRejectedValueOnce(
            new Error("Routine reminder email delivery failed"),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 701, status: "PROCESSING" },
            data: expect.objectContaining({
                status: "FAILED",
                attempts: { increment: 1 },
                lastError: "Routine reminder email delivery failed",
                nextAttemptAt: expect.any(Date),
            }),
        });
    });
});
