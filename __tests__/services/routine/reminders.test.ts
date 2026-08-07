import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, Prisma, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    buildRoutineReminderEmailEventKey,
    buildRoutineReminderEventKey,
    dispatchRoutineReminderOutbox,
} from "@/lib/services/routine/reminders";

const createInAppNotificationOnceMock = vi.hoisted(() => vi.fn());
const sendRoutineReminderNotificationMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/email", () => ({
    sendRoutineReminderNotification: sendRoutineReminderNotificationMock,
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

function buildEmailPayload(overrides: Record<string, unknown> = {}) {
    return {
        to: "somchai@example.com",
        recipientName: "สมชาย ใจดี",
        taskTitle: "ตรวจสอบระบบประจำเดือน",
        unitName: "หน่วยงานทดสอบ",
        categoryName: "หมวดหมู่ทดสอบ",
        dueDate: "2026-08-05",
        daysBefore: 2,
        actionUrl: "/dashboard?tab=routine&taskId=71&occurrenceId=91",
        occurrenceId: 91,
        ruleId: 31,
        userId: 17,
        reminderVersion: 2,
        ...overrides,
    };
}

function buildEmailNotification(payload: ReturnType<typeof buildEmailPayload>): NotificationOutbox {
    return {
        id: 502,
        type: "ROUTINE_REMINDER_EMAIL",
        eventKey: buildRoutineReminderEmailEventKey(
            payload.occurrenceId as number,
            payload.ruleId as number,
            payload.userId as number,
            payload.reminderVersion as number,
        ),
        payload: JSON.stringify(payload),
        status: "PROCESSING",
        attempts: 0,
        nextAttemptAt: new Date("2026-08-03T02:00:00.000Z"),
        lastError: null,
        createdAt: new Date("2026-08-03T02:00:00.000Z"),
        updatedAt: new Date("2026-08-03T02:00:00.000Z"),
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
            unit: { name: "หน่วยงานทดสอบ" },
            category: { name: "หมวดหมู่ทดสอบ" },
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
                user: {
                    id: 17,
                    name: "สมชาย ใจดี",
                    email: "somchai@example.com",
                    isActive: true,
                    deletedAt: null,
                },
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
        sendRoutineReminderNotificationMock.mockResolvedValue(true);
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
                actionUrl: "/dashboard?tab=routine&taskId=71&occurrenceId=91",
                dedupeKey: "routine:91:rule:31:user:17:version:2",
            }),
            prismaMock,
        );
        expect(prismaMock.notificationOutbox.createMany).toHaveBeenCalledWith({
            data: [{
                type: "ROUTINE_REMINDER_EMAIL",
                eventKey: "routine:91:rule:31:user:17:version:2:email",
                payload: JSON.stringify(buildEmailPayload()),
            }],
            skipDuplicates: true,
        });
        expect(sendRoutineReminderNotificationMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).not.toHaveBeenCalled();
    });

    it("keeps active recipients in-app when email is missing or invalid", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                assignees: [
                    buildOccurrence().assignees[0],
                    {
                        employee: {
                            status: "ACTIVE",
                            deletedAt: null,
                            user: {
                                id: 18,
                                name: "ไม่มีอีเมล",
                                email: "",
                                isActive: true,
                                deletedAt: null,
                            },
                        },
                    },
                    {
                        employee: {
                            status: "ACTIVE",
                            deletedAt: null,
                            user: {
                                id: 19,
                                name: "อีเมลไม่ถูกต้อง",
                                email: "bad@example.com\n",
                                isActive: true,
                                deletedAt: null,
                            },
                        },
                    },
                ],
            })),
        );
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        try {
            const result = await dispatchRoutineReminderOutbox(
                buildNotification(buildPayload()),
                buildPayload(),
                new Date("2026-08-03T02:00:00.000Z"),
            );

            expect(result).toBe("SENT");
            expect(createInAppNotificationOnceMock.mock.calls.map(([value]) => value.userId))
                .toEqual([17, 18, 19]);
            expect(prismaMock.notificationOutbox.createMany).toHaveBeenCalledWith({
                data: [expect.objectContaining({
                    type: "ROUTINE_REMINDER_EMAIL",
                    eventKey: "routine:91:rule:31:user:17:version:2:email",
                })],
                skipDuplicates: true,
            });
            expect(sendRoutineReminderNotificationMock).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
    });

    it("does not retry an outbox event for an invalid email address", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                assignees: [{
                    employee: {
                        status: "ACTIVE",
                        deletedAt: null,
                        user: {
                            id: 18,
                            name: "อีเมลไม่ถูกต้อง",
                            email: "not-an-email",
                            isActive: true,
                            deletedAt: null,
                        },
                    },
                }],
            })),
        );
        sendRoutineReminderNotificationMock.mockResolvedValue(false);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        try {
            const result = await dispatchRoutineReminderOutbox(
                buildNotification(buildPayload()),
                buildPayload(),
                new Date("2026-08-03T02:00:00.000Z"),
            );

            expect(result).toBe("SENT");
            expect(createInAppNotificationOnceMock).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 18 }),
                prismaMock,
            );
            expect(sendRoutineReminderNotificationMock).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
    });

    it("retries a queued reminder later on the same Bangkok calendar day", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence()),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T10:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock).toHaveBeenCalledTimes(1);
    });

    it("retries a missed reminder on the next day while the due date is still ahead", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                dueDate: new Date("2026-08-10T00:00:00.000Z"),
                task: {
                    ...buildOccurrence().task,
                    reminderRules: [{
                        ...buildOccurrence().task.reminderRules[0],
                        daysBefore: 7,
                    }],
                },
            })),
        );

        const payload = buildPayload({ dueDate: "2026-08-10" });
        const result = await dispatchRoutineReminderOutbox(
            buildNotification(payload),
            payload,
            new Date("2026-08-04T02:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock).toHaveBeenCalledTimes(1);
    });

    it("defers a reminder processed before its scheduled time", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence()),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T01:59:59.000Z"),
        );

        expect(result).toBe("DEFERRED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 501, status: "PROCESSING" },
            data: {
                status: "PENDING",
                nextAttemptAt: new Date("2026-08-03T02:00:00.000Z"),
                lastError: null,
            },
        });
    });

    it.each([
        ["inactive task", { task: { ...buildOccurrence().task, isActive: false } }],
        ["inactive rule", {
            task: {
                ...buildOccurrence().task,
                reminderRules: [{
                    ...buildOccurrence().task.reminderRules[0],
                    isActive: false,
                }],
            },
        }],
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

    it("supersedes a reminder after the Bangkok due date ends", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence()),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-05T17:00:00.000Z"),
        );

        expect(result).toBe("SUPERSEDED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 501, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded expired Routine reminder",
            },
        });
    });

    it("supersedes a same-day reminder when it is retried after the due date", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                dueDate: new Date("2026-08-05T00:00:00.000Z"),
                task: {
                    ...buildOccurrence().task,
                    reminderRules: [{
                        ...buildOccurrence().task.reminderRules[0],
                        daysBefore: 0,
                    }],
                },
            })),
        );

        const payload = buildPayload({ dueDate: "2026-08-05" });
        const result = await dispatchRoutineReminderOutbox(
            buildNotification(payload),
            payload,
            new Date("2026-08-06T02:00:00.000Z"),
        );

        expect(result).toBe("SUPERSEDED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
    });

    it("keeps the same recipient dedupe key across duplicate dispatch attempts", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence()),
        );

        const notification = buildNotification(buildPayload());
        const payload = buildPayload();
        await dispatchRoutineReminderOutbox(
            notification,
            payload,
            new Date("2026-08-03T02:00:00.000Z"),
        );
        await dispatchRoutineReminderOutbox(
            notification,
            payload,
            new Date("2026-08-03T03:00:00.000Z"),
        );

        expect(createInAppNotificationOnceMock).toHaveBeenCalledTimes(2);
        expect(createInAppNotificationOnceMock.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                dedupeKey: "routine:91:rule:31:user:17:version:2",
            }),
        );
        expect(createInAppNotificationOnceMock.mock.calls[1]?.[0]).toEqual(
            expect.objectContaining({
                dedupeKey: "routine:91:rule:31:user:17:version:2",
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
        prismaMock.user.findMany.mockResolvedValue(asNever([{
            id: 99,
            name: "ผู้ดูแลระบบ",
            email: "admin@example.com",
        }]));

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

    it("deduplicates assignee and administrator recipients for both channels", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                assignees: [
                    buildOccurrence().assignees[0],
                    {
                        employee: {
                            status: "ACTIVE",
                            deletedAt: null,
                            user: {
                                id: 99,
                                name: "ผู้ดูแลร่วม",
                                email: "admin@example.com",
                                isActive: true,
                                deletedAt: null,
                            },
                        },
                    },
                ],
                task: {
                    ...buildOccurrence().task,
                    reminderRules: [{
                        ...buildOccurrence().task.reminderRules[0],
                        recipientScope: "ASSIGNEES_AND_ADMINS",
                    }],
                },
            })),
        );
        prismaMock.user.findMany.mockResolvedValue(asNever([
            { id: 99, name: "ผู้ดูแลร่วม", email: "admin@example.com" },
            { id: 100, name: "ผู้ดูแลระบบ", email: "admin2@example.com" },
        ]));

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock.mock.calls.map(([value]) => value.userId))
            .toEqual([17, 99, 100]);
        const createManyInput = prismaMock.notificationOutbox.createMany.mock
            .calls[0]?.[0];
        expect(createManyInput?.data).toEqual([
            expect.objectContaining({
                eventKey: "routine:91:rule:31:user:17:version:2:email",
            }),
            expect.objectContaining({
                eventKey: "routine:91:rule:31:user:99:version:2:email",
            }),
            expect.objectContaining({
                eventKey: "routine:91:rule:31:user:100:version:2:email",
            }),
        ]);
        expect(sendRoutineReminderNotificationMock).not.toHaveBeenCalled();
    });

    it("does not send either channel to inactive or deleted recipients", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence({
                assignees: [
                    {
                        employee: {
                            status: "INACTIVE",
                            deletedAt: null,
                            user: {
                                id: 18,
                                name: "พนักงานไม่พร้อมใช้งาน",
                                email: "inactive@example.com",
                                isActive: true,
                                deletedAt: null,
                            },
                        },
                    },
                    {
                        employee: {
                            status: "ACTIVE",
                            deletedAt: null,
                            user: {
                                id: 19,
                                name: "บัญชีปิดใช้งาน",
                                email: "disabled@example.com",
                                isActive: false,
                                deletedAt: null,
                            },
                        },
                    },
                    {
                        employee: {
                            status: "ACTIVE",
                            deletedAt: new Date("2026-01-01T00:00:00.000Z"),
                            user: {
                                id: 20,
                                name: "พนักงานถูกลบ",
                                email: "deleted@example.com",
                                isActive: true,
                                deletedAt: null,
                            },
                        },
                    },
                ],
            })),
        );

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SUPERSEDED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
        expect(sendRoutineReminderNotificationMock).not.toHaveBeenCalled();
    });

    it("does not couple the in-app event outcome to email delivery", async () => {
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(
            asNever(buildOccurrence()),
        );
        sendRoutineReminderNotificationMock.mockResolvedValue(false);

        const result = await dispatchRoutineReminderOutbox(
            buildNotification(buildPayload()),
            buildPayload(),
            new Date("2026-08-03T02:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock).toHaveBeenCalledTimes(1);
        expect(sendRoutineReminderNotificationMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.createMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.notificationOutbox.updateMany).not.toHaveBeenCalled();
    });

    it("retries a failed Routine email independently for its recipient", async () => {
        const payload = buildEmailPayload();
        sendRoutineReminderNotificationMock.mockResolvedValue(false);

        await expect(
            dispatchRoutineReminderOutbox(
                buildEmailNotification(payload),
                payload,
            ),
        ).rejects.toThrow("Routine reminder email delivery failed");

        expect(sendRoutineReminderNotificationMock).toHaveBeenCalledTimes(1);
        expect(sendRoutineReminderNotificationMock).toHaveBeenCalledWith(payload);
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
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
