import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { runRoutineScheduler } from "@/lib/services/routine/scheduler";

const generateRoutineTaskOccurrencesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/services/routine/generation", () => ({
    generateRoutineTaskOccurrences: generateRoutineTaskOccurrencesMock,
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildOccurrence(overrides: Record<string, unknown> = {}) {
    return {
        id: 91,
        taskId: 71,
        dueDate: new Date("2026-08-05T00:00:00.000Z"),
        reminderVersion: 2,
        task: {
            id: 71,
            isActive: true,
            reminderRules: [{
                id: 31,
                daysBefore: 2,
                sendHour: 9,
                channel: "IN_APP",
                recipientScope: "ASSIGNEES",
                isActive: true,
            }],
        },
        assignees: [{
            employee: {
                status: "ACTIVE",
                deletedAt: null,
                user: { id: 17, isActive: true, deletedAt: null },
            },
        }],
        ...overrides,
    };
}

describe("Routine scheduler", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        generateRoutineTaskOccurrencesMock.mockResolvedValue({
            evaluated: 3,
            created: 3,
            existing: 0,
        });
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([{ id: 71 }]));
        prismaMock.routineOccurrence.findMany.mockResolvedValue(
            asNever([buildOccurrence()]),
        );
        prismaMock.user.findMany.mockResolvedValue(asNever([]));
        prismaMock.notificationOutbox.create.mockResolvedValue(
            asNever({ id: 501 }),
        );
    });

    it("generates occurrences and enqueues an in-app reminder at the Bangkok send hour", async () => {
        const now = new Date("2026-08-03T02:00:00.000Z");

        const result = await runRoutineScheduler(now);

        expect(result).toEqual({
            occurrencesCreated: 3,
            remindersConsidered: 1,
            outboxEnqueued: 1,
            duplicatesSkipped: 0,
            inactiveSkipped: 0,
            noRecipientSkipped: 0,
            errors: 0,
        });
        expect(generateRoutineTaskOccurrencesMock).toHaveBeenCalledWith(71, now);
        expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: "ROUTINE_REMINDER_IN_APP",
                eventKey: "routine:91:rule:31:version:2",
                payload: expect.not.stringContaining('"expected' + "Status" + '"'),
            }),
        });
    });

    it("counts a duplicate event key instead of creating another outbox row", async () => {
        prismaMock.notificationOutbox.create.mockRejectedValue({
            code: "P2002",
            meta: { target: ["eventKey"] },
        });

        const result = await runRoutineScheduler(
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result.outboxEnqueued).toBe(0);
        expect(result.duplicatesSkipped).toBe(1);
        expect(result.errors).toBe(0);
    });

    it.each([
        ["inactive task", { task: { ...buildOccurrence().task, isActive: false } }, 1, 0, 0],
        ["inactive rule", { task: { ...buildOccurrence().task, reminderRules: [{ ...buildOccurrence().task.reminderRules[0], isActive: false }] } }, 1, 0, 0],
        ["missing employee user", { assignees: [{ employee: { status: "ACTIVE", deletedAt: null, user: null } }] }, 0, 1, 1],
    ])("skips %s without enqueueing", async (_label, overrides, inactiveSkipped, remindersConsidered, noRecipientSkipped) => {
        prismaMock.routineOccurrence.findMany.mockResolvedValue(
            asNever([buildOccurrence(overrides)]),
        );

        const result = await runRoutineScheduler(
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result.inactiveSkipped).toBe(inactiveSkipped);
        expect(result.remindersConsidered).toBe(remindersConsidered);
        expect(result.noRecipientSkipped).toBe(noRecipientSkipped);
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });
});
