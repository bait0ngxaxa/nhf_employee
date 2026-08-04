import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, Prisma, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    buildRoutineReminderEventKey,
    dispatchRoutineReminderOutbox,
} from "@/lib/services/routine/reminders";

const createInAppNotificationOnceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: vi.fn(async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prisma as unknown as Prisma.TransactionClient)),
}));

vi.mock("@/lib/services/notifications/in-app", () => ({
    createInAppNotificationOnce: createInAppNotificationOnceMock,
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildNotification(payload: unknown): NotificationOutbox {
    return {
        id: 501,
        type: "ROUTINE_REMINDER_IN_APP",
        eventKey: buildRoutineReminderEventKey(91, 31, 2),
        payload: JSON.stringify(payload),
        status: "PROCESSING",
        attempts: 0,
        nextAttemptAt: new Date("2026-08-03T02:00:00.000Z"),
        lastError: null,
        createdAt: new Date("2026-08-03T02:00:00.000Z"),
        updatedAt: new Date("2026-08-03T02:00:00.000Z"),
    };
}

function buildPayload(overrides: Record<string, unknown> = {}) {
    return {
        occurrenceId: 91,
        taskId: 71,
        ruleId: 31,
        reminderVersion: 2,
        dueDate: "2026-08-05",
        createdAt: "2026-08-03T02:00:00.000Z",
        ...overrides,
    };
}

function buildOccurrence(overrides: Record<string, unknown> = {}) {
    return {
        id: 91,
        taskId: 71,
        dueDate: new Date("2026-08-05T00:00:00.000Z"),
        reminderVersion: 2,
        task: {
            id: 71,
            title: "ตรวจสอบระบบประจำเดือน",
            isActive: true,
            reminderRules: [
                {
                    id: 31,
                    daysBefore: 2,
                    sendHour: 9,
                    channel: "IN_APP",
                    recipientScope: "ASSIGNEES",
                    isActive: true,
                },
            ],
        },
        assignees: [
            {
                employee: {
                    status: "ACTIVE",
                    deletedAt: null,
                    user: { id: 17, isActive: true, deletedAt: null },
                },
            },
        ],
        ...overrides,
    };
}

describe("Routine reminder dispatch", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(
            asNever({ id: 501 }),
        );
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
    });

    it("revalidates current state and creates a deduplicated in-app notification", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence()),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 17,
                type: "ROUTINE_REMINDER",
                title: "งานใกล้ถึงกำหนด",
                referenceId: "91",
                actionUrl: "/dashboard?tab=routine&occurrenceId=91",
                dedupeKey: "routine:91:rule:31:user:17:version:2",
            }),
            prismaMock,
        );
        expect(prismaMock.notificationOutbox.updateMany).not.toHaveBeenCalled();
    });

    it.each([
        ["inactive task", { task: { ...buildOccurrence().task, isActive: false } }],
        ["version changed", { reminderVersion: 3 }],
        ["due date changed", { dueDate: new Date("2026-08-06T00:00:00.000Z") }],
    ])("supersedes a stale reminder when %s", async (_label, overrides) => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence(overrides)),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SUPERSEDED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 501, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded stale Routine reminder",
            },
        });
    });

    it("supersedes a reminder when no active employee account can receive it", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                assignees: [{ employee: { status: "ACTIVE", deletedAt: null, user: null } }],
            })),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SUPERSEDED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: "SUPERSEDED" }),
            }),
        );
    });

    it("resolves administrator recipients from current active users", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                task: {
                    ...buildOccurrence().task,
                    reminderRules: [{
                        ...buildOccurrence().task.reminderRules[0],
                        recipientScope: "ADMINS",
                    }],
                },
            })),
        );
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 99 }]));

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 99 }),
            prismaMock,
        );
    });

    it("does not retry an invalid payload", async () => {
        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            { occurrenceId: 91 },
        );

        expect(result).toBe("SUPERSEDED");
        expect(prismaMock.routineOccurrence.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 501, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded invalid Routine reminder payload",
            },
        });
    });
});
